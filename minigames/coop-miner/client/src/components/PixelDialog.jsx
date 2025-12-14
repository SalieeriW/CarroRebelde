const PixelDialog = ({
  type = 'confirm',
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
}) => {
  return (
    <div className="pixel-dialog-overlay">
      <div className="pixel-dialog">
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
        </div>

        <div className="dialog-body">
          <p className="dialog-message">{message}</p>
        </div>

        <div className="dialog-actions">
          {type === 'confirm' && onCancel && (
            <button className="pixel-button" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button className="pixel-button" onClick={onConfirm}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PixelDialog;
