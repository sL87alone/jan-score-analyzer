 import { ReactNode } from "react";
 
 interface ButtonProps {
   children: ReactNode;
   onClick?: () => void;
   variant?: "primary" | "outline" | "ghost";
   size?: "default" | "lg";
   className?: string;
   type?: "button" | "submit";
   disabled?: boolean;
 }
 
 export function Button({
   children,
   onClick,
   variant = "primary",
   size = "default",
   className = "",
   type = "button",
   disabled = false,
 }: ButtonProps) {
   const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
   
   const variants = {
     primary: "bg-primary text-primary-foreground hover:bg-primary/90",
     outline: "border border-input bg-background hover:bg-muted",
     ghost: "hover:bg-muted",
   };
 
   const sizes = {
     default: "h-10 px-4 py-2 text-sm",
     lg: "h-12 px-8 py-3 text-lg",
   };
 
   return (
     <button
       type={type}
       onClick={onClick}
       disabled={disabled}
       className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
     >
       {children}
     </button>
   );
 }