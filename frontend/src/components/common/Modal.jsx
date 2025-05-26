import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ 
 isOpen, 
 onClose, 
 title, 
 children, 
 size = 'md',
 showCloseButton = true,
 closeOnBackdrop = true,
 closeOnEsc = true,
 footer = null,
 className = ''
}) => {
 const modalRef = useRef(null);
 const backdropRef = useRef(null);

 const sizeClasses = {
   sm: 'max-w-md',
   md: 'max-w-lg',
   lg: 'max-w-2xl',
   xl: 'max-w-4xl',
   full: 'max-w-full mx-4'
 };

 useEffect(() => {
   if (isOpen) {
     document.body.style.overflow = 'hidden';
     modalRef.current?.focus();
   } else {
     document.body.style.overflow = 'unset';
   }

   return () => {
     document.body.style.overflow = 'unset';
   };
 }, [isOpen]);

 useEffect(() => {
   const handleEsc = (e) => {
     if (e.key === 'Escape' && closeOnEsc && isOpen) {
       onClose();
     }
   };

   if (isOpen) {
     document.addEventListener('keydown', handleEsc);
   }

   return () => {
     document.removeEventListener('keydown', handleEsc);
   };
 }, [isOpen, closeOnEsc, onClose]);

 const handleBackdropClick = (e) => {
   if (closeOnBackdrop && e.target === backdropRef.current) {
     onClose();
   }
 };

 if (!isOpen) return null;

 const modalContent = (
   <div
     ref={backdropRef}
     className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
     onClick={handleBackdropClick}
   >
     <div
       ref={modalRef}
       className={`bg-white rounded-lg shadow-xl transform transition-all duration-300 scale-100 ${sizeClasses[size]} w-full ${className}`}
       role="dialog"
       aria-modal="true"
       aria-labelledby={title ? "modal-title" : undefined}
       tabIndex={-1}
     >
       {/* Header */}
       {(title || showCloseButton) && (
         <div className="flex items-center justify-between p-6 border-b border-gray-200">
           {title && (
             <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
               {title}
             </h2>
           )}
           {showCloseButton && (
             <button
               onClick={onClose}
               className="text-gray-400 hover:text-gray-600 transition-colors p-1"
               aria-label="Close modal"
             >
               <svg
                 className="w-6 h-6"
                 fill="none"
                 stroke="currentColor"
                 viewBox="0 0 24 24"
               >
                 <path
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   strokeWidth={2}
                   d="M6 18L18 6M6 6l12 12"
                 />
               </svg>
             </button>
           )}
         </div>
       )}

       {/* Body */}
       <div className="p-6">
         {children}
       </div>

       {/* Footer */}
       {footer && (
         <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
           {footer}
         </div>
       )}
     </div>
   </div>
 );

 return createPortal(modalContent, document.body);
};

// Confirmation Modal Component
export const ConfirmModal = ({ 
 isOpen, 
 onClose, 
 onConfirm, 
 title = 'Confirm Action', 
 message = 'Are you sure you want to continue?',
 confirmText = 'Confirm',
 cancelText = 'Cancel',
 type = 'default' // default, danger, warning
}) => {
 const typeStyles = {
   default: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
   danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
   warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
 };

 const handleConfirm = () => {
   onConfirm();
   onClose();
 };

 return (
   <Modal
     isOpen={isOpen}
     onClose={onClose}
     title={title}
     size="sm"
     footer={
       <>
         <button
           type="button"
           onClick={onClose}
           className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
         >
           {cancelText}
         </button>
         <button
           type="button"
           onClick={handleConfirm}
           className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${typeStyles[type]}`}
         >
           {confirmText}
         </button>
       </>
     }
   >
     <p className="text-gray-600">{message}</p>
   </Modal>
 );
};

// Loading Modal Component
export const LoadingModal = ({ isOpen, message = 'Loading...' }) => {
 return (
   <Modal
     isOpen={isOpen}
     onClose={() => {}}
     showCloseButton={false}
     closeOnBackdrop={false}
     closeOnEsc={false}
     size="sm"
   >
     <div className="flex items-center justify-center space-x-3">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
       <span className="text-gray-600">{message}</span>
     </div>
   </Modal>
 );
};

export default Modal;