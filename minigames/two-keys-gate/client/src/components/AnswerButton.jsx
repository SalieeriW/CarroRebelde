import React from 'react';

const AnswerButton = ({ label, icon, selected, onClick, color, shape }) => {
  const buttonClass = `answer-button ${selected ? 'selected' : ''} ${color || ''} ${shape || ''}`;

  return (
    <button
      className={buttonClass}
      onClick={onClick}
      data-shape={shape}
      data-color={color}
    >
      {icon && <span className="button-icon">{icon}</span>}
      <span className="button-label">{label}</span>
    </button>
  );
};

export default AnswerButton;
