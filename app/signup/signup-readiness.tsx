
"use client";

import { useEffect } from "react";

type Check = {
  label: string;
  valid: boolean;
};

type BusinessHour = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function fieldValue(
  form: HTMLFormElement,
  name: string
): string {
  const field = form.elements.namedItem(name);

  if (field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement) {
    return field.value.trim();
  }

  return "";
}

function isChecked(
  form: HTMLFormElement,
  name: string
): boolean {
  const field = form.elements.namedItem(name);

  return field instanceof HTMLInputElement
    ? field.checked
    : false;
}

function validHours(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length !== 7) {
      return false;
    }

    const seen = new Set<number>();

    return parsed.every((item: unknown) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const day = item as BusinessHour;

      if (
        !Number.isInteger(day.weekday) ||
        day.weekday < 0 ||
        day.weekday > 6 ||
        seen.has(day.weekday) ||
        typeof day.is_open !== "boolean" ||
        typeof day.open_time !== "string" ||
        typeof day.close_time !== "string" ||
        !TIME_REGEX.test(day.open_time) ||
        !TIME_REGEX.test(day.close_time) ||
        (day.is_open && day.open_time === day.close_time)
      ) {
        return false;
      }

      seen.add(day.weekday);
      return true;
    });
  } catch {
    return false;
  }
}

function selectedServiceCount(
  form: HTMLFormElement
): number {
  try {
    const raw = fieldValue(form, "application_services");
    const services: unknown = JSON.parse(raw);

    return Array.isArray(services)
      ? services.filter(
          (service) =>
            typeof service === "string" &&
            service.trim().length > 0
        ).length
      : 0;
  } catch {
    return 0;
  }
}

function validWebsite(value: string): boolean {
  if (!value) return true;

  try {
    const normalized = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const url = new URL(normalized);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

function photoStatus(
  form: HTMLFormElement
): boolean | null {
  const fileInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[type="file"]'
    )
  );

  const photoInputs = fileInputs.filter((input) => {
    const description = [
      input.name,
      input.id,
      input.getAttribute("aria-label") ?? "",
      input.closest("label")?.textContent ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return /photo|image|picture|garage/.test(description);
  });

  const hiddenNames = [
    "business_photo_url",
    "business_photo_path",
    "business_image_url",
    "business_image_path",
    "photo_url",
    "photo_path",
    "image_url",
  ];

  const hasStoredPhoto = hiddenNames.some(
    (name) => fieldValue(form, name).length > 0
  );

  const hasSelectedFile = photoInputs.some(
    (input) => (input.files?.length ?? 0) > 0
  );

  const hasPhotoPreview = Array.from(
    form.querySelectorAll<HTMLImageElement>("img")
  ).some((image) => {
    const alt = image.alt.toLowerCase();
    const src = image.getAttribute("src") ?? "";

    return (
      /business photo|garage photo|business image/.test(alt) ||
      src.startsWith("blob:") ||
      src.startsWith("data:image/")
    );
  });

  const hasPhotoSection =
    photoInputs.length > 0 ||
    hasStoredPhoto ||
    hasPhotoPreview ||
    /business photo/i.test(form.textContent ?? "");

  if (!hasPhotoSection) {
    return null;
  }

  return (
    hasStoredPhoto ||
    hasSelectedFile ||
    hasPhotoPreview
  );
}

function getChecks(form: HTMLFormElement): Check[] {
  const firstName = fieldValue(form, "first_name");
  const lastName = fieldValue(form, "last_name");
  const email = fieldValue(form, "email");

  const primaryPhone = fieldValue(form, "primary_phone");
  const secondaryPhone = fieldValue(form, "secondary_phone");

  const businessName = fieldValue(form, "business_name");
  const businessAddress = fieldValue(
    form,
    "business_address"
  );
  const postalCode = fieldValue(
    form,
    "business_postal_code"
  );

  const neq = fieldValue(form, "business_neq");
  const businessPhone = fieldValue(
    form,
    "business_phone"
  );
  const website = fieldValue(form, "business_website");

  const description = fieldValue(
    form,
    "application_description"
  );

  const services = selectedServiceCount(form);
  const hours = fieldValue(form, "business_hours");

  const password = fieldValue(form, "password");
  const confirmPassword = fieldValue(
    form,
    "confirm_password"
  );

  const remaining = Math.max(
    0,
    30 - description.length
  );

  const photo = photoStatus(form);

  const checks: Check[] = [
    {
      label: "Enter your first and last name",
      valid: firstName.length > 0 && lastName.length > 0,
    },
    {
      label: "Enter a valid email address",
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    },
    {
      label: "Enter a valid primary phone number",
      valid: PHONE_REGEX.test(primaryPhone),
    },
    {
      label: "Correct the secondary phone number",
      valid:
        !secondaryPhone ||
        PHONE_REGEX.test(secondaryPhone),
    },
    {
      label: "Enter your business name",
      valid: businessName.length > 0,
    },
    {
      label: "Complete your business address",
      valid:
        businessAddress.length > 0 &&
        postalCode.length > 0,
    },
    {
      label: "Enter your 10-digit NEQ",
      valid: /^\d{10}$/.test(neq),
    },
    {
      label: "Enter a valid business phone number",
      valid: PHONE_REGEX.test(businessPhone),
    },
    {
      label: "Correct your business website URL",
      valid: validWebsite(website),
    },
    {
      label:
        services === 0
          ? "Select at least one service"
          : `${services} service${services > 1 ? "s" : ""} selected`,
      valid: services > 0,
    },
    {
      label:
        description.length < 30
          ? `Business description: ${description.length}/30 characters (${remaining} remaining)`
          : description.length > 1500
            ? "Business description exceeds 1,500 characters"
            : `Business description complete (${description.length} characters)`,
      valid:
        description.length >= 30 &&
        description.length <= 1500,
    },
    {
      label: "Review your business opening hours",
      valid: validHours(hours),
    },
    {
      label:
        "Password needs 8 characters, an uppercase letter and a special character",
      valid:
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[^A-Za-z0-9\s]/.test(password),
    },
    {
      label: "Passwords must match",
      valid:
        confirmPassword.length > 0 &&
        password === confirmPassword,
    },
    {
      label: "Accept the Terms of Service and Privacy Policy",
      valid: isChecked(form, "legal_consent"),
    },
  ];

  if (photo !== null) {
    checks.splice(6, 0, {
      label: photo
        ? "Business photo added"
        : "Upload your required business photo",
      valid: photo,
    });
  }

  return checks;
}

function createElement(
  tag: string,
  className: string,
  text: string
): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export default function SignupReadiness() {
  useEffect(() => {
    const form = Array.from(
      document.querySelectorAll<HTMLFormElement>("form")
    ).find((candidate) =>
      candidate.querySelector(
        'input[name="account_type"]'
      )
    );

    if (!form) return;

    const submitButton = Array.from(
      form.querySelectorAll<HTMLButtonElement>(
        'button[type="submit"]'
      )
    ).find((button) =>
      /submit provider application|create client account/i.test(
        button.textContent ?? ""
      )
    );

    if (!submitButton) return;

    const container = document.createElement("aside");

    container.id = "mecatrex-signup-readiness";
    container.setAttribute("aria-live", "polite");
    container.className =
      "mt-6 rounded-[18px] border border-[#C9D6E5] bg-[#F8FAFD] p-4";

    submitButton.insertAdjacentElement(
      "beforebegin",
      container
    );

    let frameId: number | null = null;

    function render() {
      if (
        fieldValue(form!, "account_type") !== "provider"
      ) {
        container.hidden = true;
        return;
      }

      container.hidden = false;

      const checks = getChecks(form!);
      const missing = checks.filter(
        (check) => !check.valid
      );
      const completed = checks.length - missing.length;
      const allComplete = missing.length === 0;

      container.className = allComplete
        ? "mt-6 rounded-[18px] border border-[#A6E8C4] bg-[#ECFDF3] p-4"
        : "mt-6 rounded-[18px] border border-[#C9D6E5] bg-[#F8FAFD] p-4";

      container.replaceChildren();

      const heading = createElement(
        "h3",
        "text-[15px] font-extrabold text-[#101828]",
        allComplete
          ? "✓ Your application is ready"
          : "Application checklist"
      );

      container.appendChild(heading);

      const subtitle = createElement(
        "p",
        "mt-1 text-[12px] leading-5 text-[#667085]",
        allComplete
          ? "All the checks below are complete."
          : `${completed} of ${checks.length} checks complete. Finish the items below to submit your application.`
      );

      container.appendChild(subtitle);

      const progress = document.createElement("div");
      progress.className =
        "mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E4E7EC]";

      const progressFill = document.createElement("div");
      progressFill.className =
        "h-full rounded-full bg-[#4771A6] transition-all duration-300";
      progressFill.style.width = `${
        (completed / checks.length) * 100
      }%`;

      progress.appendChild(progressFill);
      container.appendChild(progress);

      if (missing.length > 0) {
        const list = document.createElement("ul");
        list.className = "mt-4 space-y-2";

        for (const check of missing) {
          const item = createElement(
            "li",
            "flex items-start gap-2 text-[12px] font-semibold leading-5 text-[#B42318]",
            `✕ ${check.label}`
          );
          list.appendChild(item);
        }

        container.appendChild(list);
      } else {
        const success = createElement(
          "p",
          "mt-3 text-[12px] font-semibold text-[#027A48]",
          "✓ Business details, services, photo (if present), hours, password and consent checked."
        );

        container.appendChild(success);
      }

      if (allComplete && submitButton!.disabled) {
        const warning = createElement(
          "p",
          "mt-3 rounded-xl bg-white p-3 text-[12px] font-medium text-[#B54708]",
          "The submit button is still disabled. Another requirement in the registration form may need attention."
        );

        container.appendChild(warning);
      }
    }

    function scheduleUpdate() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        render();
      });
    }

    form.addEventListener("input", scheduleUpdate);
    form.addEventListener("change", scheduleUpdate);
    form.addEventListener("click", scheduleUpdate);

    const observer = new MutationObserver(scheduleUpdate);

    observer.observe(submitButton, {
      attributes: true,
      attributeFilter: ["disabled"],
    });

    scheduleUpdate();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      observer.disconnect();

      form.removeEventListener("input", scheduleUpdate);
      form.removeEventListener("change", scheduleUpdate);
      form.removeEventListener("click", scheduleUpdate);

      container.remove();
    };
  }, []);

  return null;
}
