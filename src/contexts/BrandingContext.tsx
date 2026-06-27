import { createContext, useContext, useEffect, ReactNode } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";

export interface BrandingContextType {
  companyName: string;
  tagline: string;
  supportEmail: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  emailFromName?: string;
  replyToEmail?: string;
  loginMessage?: string;
  loginBackgroundUrl?: string;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: config, isLoading } = useAppConfig();

  const primaryColor = config?.branding?.primaryColor || "#6366f1";

  // Inject the primary brand color as a CSS custom property so any component
  // can reference var(--brand-primary) without coupling to Tailwind config.
  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", primaryColor);
  }, [primaryColor]);

  const value: BrandingContextType = {
    companyName: config?.branding?.companyName || "CollabAi",
    tagline: config?.branding?.tagline || "AI-Powered Collaboration Platform",
    supportEmail: config?.branding?.supportEmail || "support@collabai.software",
    logoUrl: config?.branding?.logoUrl || undefined,
    faviconUrl: config?.branding?.faviconUrl || undefined,
    primaryColor,
    secondaryColor: config?.branding?.secondaryColor || undefined,
    emailFromName: config?.branding?.emailFromName || undefined,
    replyToEmail: config?.branding?.replyToEmail || undefined,
    loginMessage: config?.branding?.loginMessage || "Welcome to Control Tower",
    loginBackgroundUrl: config?.branding?.loginBackgroundUrl || undefined,
    isLoading,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}
