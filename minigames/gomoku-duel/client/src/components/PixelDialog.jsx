import React from 'react';

const PixelDialog = ({
  type = 'alert',
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
}) => {
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && type === 'confirm') {
      handleCancel();
    }
  };

  return (
    <div className="pixel-modal-overlay" onClick={handleOverlayClick}>
      <div className="pixel-modal">
        {title && <div className="pixel-modal-title">{title}</div>}
        <div className="pixel-modal-message">{message}</div>
        <div className="pixel-modal-buttons">
          {type === 'confirm' && (
            <button
              className="pixel-button"
              onClick={handleCancel}
              style={{ background: 'var(--pixel-red)', color: 'var(--pixel-white)' }}
            >
              {cancelText}
            </button>
          )}
          <button
            className="pixel-button"
            onClick={handleConfirm}
            style={{ background: 'var(--pixel-green)', color: 'var(--pixel-black)' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PixelDialog;

