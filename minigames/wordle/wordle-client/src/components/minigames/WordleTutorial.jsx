import React from 'react';
import '../../styles/wordle.css'; // Asegúrate de importar los estilos aquí también si es necesario

const WordleTutorial = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="wordle-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.9)' }}>
      <div className="wordle-result" style={{ maxWidth: '500px', textAlign: 'left' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>CÓMO JUGAR</h2>
        <p>Adivina la palabra oculta en 6 intentos.</p>
        <p>Supongamos que la solución tiene 5 letras.</p>
        <p>Cada intento debe ser una palabra válida de 5 letras dentro del diccionario.</p>
        <p>Después de cada intento, el color de las letras cambiará para mostrar qué tan cerca estás.</p>
        
        <hr style={{ borderColor: '#333', margin: '15px 0' }} />

        <div style={{ marginBottom: '10px' }}>
             <strong>Ejemplos</strong>
        </div>

        {/* Ejemplo Correcto */}
        <div className="wordle-row" style={{ justifyContent: 'flex-start', marginBottom: '10px' }}>
            <div className="wordle-cell correct" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>G</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>A</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>T</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>O</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>S</div>
        </div>
        <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>La letra <strong>G</strong> está en la palabra y en la posición correcta.</p>

        {/* Ejemplo Presente */}
        <div className="wordle-row" style={{ justifyContent: 'flex-start', marginBottom: '10px' }}>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>V</div>
            <div className="wordle-cell present" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>I</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>D</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>E</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>O</div>
        </div>
        <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>La letra <strong>I</strong> está en la palabra pero en la posición incorrecta.</p>

        {/* Ejemplo Ausente */}
        <div className="wordle-row" style={{ justifyContent: 'flex-start', marginBottom: '10px' }}>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>C</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>A</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>R</div>
            <div className="wordle-cell absent" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>R</div>
            <div className="wordle-cell" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>O</div>
        </div>
        <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>La letra <strong>R</strong> no está en la palabra.</p>

        <button 
            onClick={onClose}
            style={{ 
                width: '100%', 
                padding: '10px', 
                backgroundColor: 'var(--correct)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
            }}>
            ¡ENTENDIDO! (Shift+H para cerrar)
        </button>
      </div>
    </div>
  );
};

export default WordleTutorial;