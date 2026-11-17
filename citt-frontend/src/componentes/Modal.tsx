import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  icono?: React.ReactNode;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  titulo,
  icono,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="flex shrink-0 justify-between items-center px-4 py-2 border-b border-gray-200 sm:px-6 sm:py-4">
          <h3 className="m-0 flex items-center gap-2 text-xl">
            {icono && <span className="text-primary">{icono}</span>}
            {titulo}
          </h3>
          <button
            type="button"
            aria-label="Cerrar ventana"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X size={24} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
