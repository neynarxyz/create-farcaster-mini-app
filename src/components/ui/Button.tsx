interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`w-full max-w-xs mx-auto block bg-[#7C65C1] text-white py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7C65C1] hover:bg-[#6952A3] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
