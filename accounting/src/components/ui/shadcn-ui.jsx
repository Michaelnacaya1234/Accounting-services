import React, { forwardRef, useMemo, useState, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// Utility: simple class merge
export function cn(...vals) {
  return vals.filter(Boolean).join(' ');
}

// Button
export const Button = forwardRef(function Button(
  { className = '', variant = 'default', size = 'default', disabled, ...props },
  ref
) {
  const variants = {
    default: 'bg-primary text-white hover:bg-primary-dark',
    outline: 'border border-slate-300 hover:bg-slate-50',
    secondary: 'bg-slate-900 text-white hover:bg-black/90',
    ghost: 'hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-6 text-base',
    icon: 'h-10 w-10',
  };
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-60',
        variants[variant] || variants.default,
        sizes[size] || sizes.default,
        className
      )}
      {...props}
    />
  );
});

// Input
export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
      {...props}
    />
  );
});

// Label
export function Label({ className = '', ...props }) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-slate-700', className)}
      {...props}
    />
  );
}

// Card components
export function Card({ className = '', ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-slate-200 bg-white shadow-card', className)}
      {...props}
    />
  );
}
export function CardHeader({ className = '', ...props }) {
  return <div className={cn('p-6 pb-3', className)} {...props} />;
}
export function CardTitle({ className = '', ...props }) {
  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;
}
export function CardDescription({ className = '', ...props }) {
  return <p className={cn('text-sm text-slate-600', className)} {...props} />;
}
export function CardContent({ className = '', ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
export function CardFooter({ className = '', ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

// Dialog (minimal, shadcn-like API)
const DialogCtx = createContext({ open: false, setOpen: () => {} });

export function Dialog({ open, onOpenChange, children }) {
  const ctx = useMemo(() => ({ open: !!open, setOpen: onOpenChange || (() => {}) }), [open, onOpenChange]);
  return <DialogCtx.Provider value={ctx}>{children}</DialogCtx.Provider>;
}

export function DialogTrigger({ asChild, children }) {
  const { setOpen } = useContext(DialogCtx);
  const onClick = useCallback(() => setOpen?.(true), [setOpen]);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick });
  }
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      {children}
    </Button>
  );
}

export function DialogClose({ asChild, children }) {
  const { setOpen } = useContext(DialogCtx);
  const onClick = useCallback(() => setOpen?.(false), [setOpen]);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick });
  }
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      {children || 'Close'}
    </Button>
  );
}

export function DialogContent({ className = '', children }) {
  const { open, setOpen } = useContext(DialogCtx);
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-100 transition-opacity"
        onClick={() => setOpen?.(false)}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-md max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'transition-all duration-200',
          className
        )}
        role="dialog"
        aria-modal="true"
        data-state="open"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className = '', ...props }) {
  return <div className={cn('p-6 pb-3', className)} {...props} />;
}
export function DialogTitle({ className = '', ...props }) {
  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;
}
export function DialogDescription({ className = '', ...props }) {
  return <p className={cn('text-sm text-slate-600', className)} {...props} />;
}
export function DialogFooter({ className = '', ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
