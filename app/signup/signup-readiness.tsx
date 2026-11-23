
"use client";

import { useEffect } from "react";
import { validateBusinessHours } from "@/lib/business-hours";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

function getValue(
  form: HTMLFormElement,
  name: string
): string {
  const element = form.elements.namedItem(name);

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.value.trim();
  }

  return "";
}

function getInput(
  form: HTMLFormElement,
  name: string
): HTMLElement | null {
  const element = form.elements.namedItem(name);

  return element instanceof HTMLElement
    ? element
    : null;
}

function isChecked(
  form: HTMLFormElement,
  name: string
): boolean {
  const element = form.elements.namedItem(name);

  return element instanceof HTMLInputElement
    ? element.checked
    : false;
}

function selectedServices(
  form: HTMLFormElement
): number {
  try {
    const parsed: unknown = JSON.parse(
      getValue(form, "application_services")
    );

    if (!Array.isArray(parsed)) return 0;

    return parsed.filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    ).length;
  } catch {
    return 0;
  }
}

function validHours(
  form: HTMLFormElement
): boolean {
  try {
    const parsed: unknown = JSON.parse(
      getValue(form, "business_hours")
    );

    return validateBusinessHours(parsed) !== null;
  } catch {
    return false;
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
      ["https:", "http:"].includes(url.protocol) &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

export default function SignupReadiness() {
  useEffect(() => {
    const form = Array.from(
      document.querySelectorAll<HTMLFormElement>("form")
    ).find(
      (candidate) =>
        candidate.querySelector(
          'input[name="account_type"]'
        ) !== null
    );

    if (!form) return;

    const submitButton = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    if (!submitButton) return;

    const touched = new Set<string>();
    const decorated = new Set<HTMLElement>();

    let showAll = false;
    let frame: number | null = null;

    function removeErrors() {
      for (const element of decorated) {
        delete element.dataset.mecatrexError;
      }

      decorated.clear();
    }

    function mark(
      name: string,
      valid: boolean,
      message: string,
      customTarget?: HTMLElement | null
    ) {
      const input = customTarget ?? getInput(form!, name);

      if (!input) return;

      const target =
        customTarget ??
        input.closest<HTMLElement>("label") ??
        input;

      const visible =
        !valid &&
        (showAll || touched.has(name));

      if (visible) {
        target.dataset.mecatrexError = message;
        decorated.add(target);
      } else {
        delete target.dataset.mecatrexError;
      }
    }

    function validate() {
      removeErrors();

      if (getValue(form!, "account_type") !== "provider") {
        return;
      }

      const firstName = getValue(form!, "first_name");
      const lastName = getValue(form!, "last_name");
      const email = getValue(form!, "email");

      const primaryPhone = getValue(
        form!,
        "primary_phone"
      );

      const secondaryPhone = getValue(
        form!,
        "secondary_phone"
      );

      mark(
        "first_name",
        firstName.length > 0,
        "First name is required."
      );

      mark(
        "last_name",
        lastName.length > 0,
        "Last name is required."
      );

      mark(
        "email",
        EMAIL_REGEX.test(email),
        "Enter a valid email address."
      );

      mark(
        "primary_phone",
        PHONE_REGEX.test(primaryPhone),
        "Use format 514-555-1234."
      );

      mark(
        "secondary_phone",
        !secondaryPhone ||
          PHONE_REGEX.test(secondaryPhone),
        "Use format 514-555-1234."
      );

      mark(
        "business_name",
        getValue(form!, "business_name").length > 0,
        "Business name is required."
      );

      mark(
        "business_address",
        getValue(form!, "business_address").length > 0,
        "Business address is required."
      );

      mark(
        "business_postal_code",
        getValue(form!, "business_postal_code").length > 0,
        "Postal code is required."
      );

      mark(
        "business_neq",
        /^\d{10}$/.test(
          getValue(form!, "business_neq")
        ),
        "Enter exactly 10 digits."
      );

      mark(
        "business_phone",
        PHONE_REGEX.test(
          getValue(form!, "business_phone")
        ),
        "Enter a valid business phone number."
      );

      mark(
        "business_website",
        validWebsite(
          getValue(form!, "business_website")
        ),
        "Enter a valid website URL."
      );

      const photoInput = getInput(
        form!,
        "business_photo"
      );

      const photoFile =
        photoInput instanceof HTMLInputElement
          ? photoInput.files?.[0]
          : undefined;

      const photoValid =
        photoFile !== undefined &&
        photoFile.size > 0 &&
        photoFile.size <= 5 * 1024 * 1024 &&
        [
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(photoFile.type);

      mark(
        "business_photo",
        photoValid,
        "Upload a JPG, PNG or WebP photo (maximum 5 MB).",
        document.getElementById("business-photo")
      );

      const serviceCount = selectedServices(form!);

      mark(
        "application_services",
        serviceCount > 0,
        "Select at least one service.",
        form!.querySelector<HTMLElement>(
          "fieldset:has(#signup-service-search)"
        )
      );

      const otherServiceInput =
        form!.querySelector<HTMLInputElement>(
          'input[placeholder="Enter your custom service"]'
        );

      if (otherServiceInput) {
        mark(
          "other_service",
          otherServiceInput.value.trim().length > 0,
          "Describe your additional service.",
          otherServiceInput.closest<HTMLElement>("label")
        );
      }

      const description = getValue(
        form!,
        "application_description"
      );

      mark(
        "application_description",
        description.length >= 30 &&
          description.length <= 1500,
        description.length < 30
          ? `Minimum 30 characters. ${Math.max(
              0,
              30 - description.length
            )} remaining.`
          : "Maximum 1,500 characters."
      );

      mark(
        "business_hours",
        validHours(form!),
        "Check the opening and closing times.",
        document.getElementById("business-hours")
      );

      const passwordInput =
        form!.elements.namedItem("password");

      const confirmInput =
        form!.elements.namedItem("confirm_password");

      const password =
        passwordInput instanceof HTMLInputElement
          ? passwordInput.value
          : "";

      const confirmation =
        confirmInput instanceof HTMLInputElement
          ? confirmInput.value
          : "";

      mark(
        "password",
        PASSWORD_REGEX.test(password),
        "Use 8+ characters, one uppercase letter and one special character."
      );

      mark(
        "confirm_password",
        confirmation.length > 0 &&
          confirmation === password,
        "Passwords must match."
      );

      mark(
        "legal_consent",
        isChecked(form!, "legal_consent"),
        "Accept the Terms of Service and Privacy Policy."
      );
    }

    function scheduleValidation() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;
        validate();
      });
    }

    function onInput(event: Event) {
      const target = event.target;

      if (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement) {
        if (target.name) {
          touched.add(target.name);
        }

        if (target.closest("#business-hours")) {
          touched.add("business_hours");
        }
      }

      scheduleValidation();
    }

    function onClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      if (target.closest("fieldset:has(#signup-service-search)")) {
        touched.add("application_services");
      }

      scheduleValidation();
    }

    function onFocusOut(event: FocusEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (target.name) {
          touched.add(target.name);
        }
      }

      scheduleValidation();
    }

    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("click", onClick);
    form.addEventListener("focusout", onFocusOut);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          showAll = true;
          scheduleValidation();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(submitButton);

    scheduleValidation();

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      observer.disconnect();

      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("click", onClick);
      form.removeEventListener("focusout", onFocusOut);

      removeErrors();
    };
  }, []);

  return (
    <style>{`
      #business-photo[data-mecatrex-error],
      #business-hours[data-mecatrex-error],
      fieldset[data-mecatrex-error] {
        border-color: #e5484d !important;
        outline: 1px solid #e5484d;
        outline-offset: 2px;
      }

      label[data-mecatrex-error] input:not([type="checkbox"]):not([type="file"]),
      label[data-mecatrex-error] textarea,
      label[data-mecatrex-error] select,
      input[data-mecatrex-error],
      textarea[data-mecatrex-error] {
        border-color: #e5484d !important;
        box-shadow: 0 0 0 3px rgba(229, 72, 77, 0.08) !important;
      }

      label[data-mecatrex-error]::after,
      fieldset[data-mecatrex-error]::after,
      #business-photo[data-mecatrex-error]::after,
      #business-hours[data-mecatrex-error]::after,
      input[data-mecatrex-error] + span {
        color: #c62828;
      }

      label[data-mecatrex-error]::after,
      fieldset[data-mecatrex-error]::after,
      #business-photo[data-mecatrex-error]::after,
      #business-hours[data-mecatrex-error]::after {
        content: attr(data-mecatrex-error);
        display: block;
        margin-top: 7px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.5;
      }
    `}</style>
  );
}
