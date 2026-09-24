import { useEffect } from "react";
import { useLocation } from "wouter";

export function AndroidUnlockPage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/direct-unlock");
  }, [navigate]);
  return null;
}
