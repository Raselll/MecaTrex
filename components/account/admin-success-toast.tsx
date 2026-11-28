"use client";
import SuccessToasts,{useSuccessToast} from "./success-toasts";
import {useEffect,useState} from "react";
export default function AdminSuccessToast({message}:{message:string}){
 const [mountedMessage,setMountedMessage]=useState("");
 useEffect(()=>{setMountedMessage(message)},[message]);
 useSuccessToast(mountedMessage);
 return <SuccessToasts/>;
}