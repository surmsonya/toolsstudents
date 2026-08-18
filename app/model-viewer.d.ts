import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  alt?: string;
  "auto-rotate"?: boolean;
  "auto-rotate-delay"?: string;
  "camera-controls"?: boolean;
  class?: string;
  "interaction-prompt"?: string;
  loading?: "auto" | "eager" | "lazy";
  "rotation-per-second"?: string;
  "shadow-intensity"?: string;
  src?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
