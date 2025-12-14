import React from 'react';

/**
 * PixelDialog - 像素艺术风格对话框组件
 * 替代原生的alert()和confirm()，保持游戏沉浸感
 *
 * @param {string} type - 'alert' | 'confirm'
 * @param {string} title - 对话框标题
 * @param {string} message - 对话框消息
 * @param {function} onConfirm - 确认回调
 * @param {function} onCancel - 取消回调
 * @param {string} confirmText - 确认按钮文本（默认"Aceptar"）
 * @param {string} cancelText - 取消按钮文本（默认"Cancelar"）
 */
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

  // Prevent background click from closing
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && type === 'confirm') {
      // For confirm dialogs, clicking outside acts as cancel
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
