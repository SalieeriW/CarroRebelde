import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [monitorCode, setMonitorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(username, password);
      } else {
        result = await register(username, password, monitorCode || undefined);
      }

      if (!result.success) {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Press Start 2P", monospace',
      padding: '20px'
    }}>
      <div style={{
        background: '#1a1a2e',
        border: '8px solid #16213e',
        boxShadow: '8px 8px 0px #0f0f23',
        padding: '40px',
        maxWidth: '400px',
        width: '100%'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏎️</div>
          <h1 style={{
            fontSize: '24px',
            color: '#ffd700',
            textShadow: '3px 3px 0px #1a1a2e',
            margin: 0
          }}>
            BLIND RALLY
          </h1>
          <div style={{
            fontSize: '10px',
            color: '#888',
            marginTop: '10px'
          }}>
            {isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              color: '#888',
              marginBottom: '8px'
            }}>
              NOMBRE DE USUARIO
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontFamily: '"Press Start 2P", monospace',
                background: '#0f3460',
                border: '4px solid #16213e',
                color: '#fff',
                boxSizing: 'border-box'
              }}
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              color: '#888',
              marginBottom: '8px'
            }}>
              CONTRASEÑA
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontFamily: '"Press Start 2P", monospace',
                background: '#0f3460',
                border: '4px solid #16213e',
                color: '#fff',
                boxSizing: 'border-box'
              }}
              required
              minLength={4}
            />
          </div>

          {/* Monitor Code (only for register) */}
          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '10px',
                color: '#888',
                marginBottom: '8px'
              }}>
                CÓDIGO MONITOR (opcional)
              </label>
              <input
                type="password"
                value={monitorCode}
                onChange={(e) => setMonitorCode(e.target.value)}
                placeholder="Solo para monitores"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: '"Press Start 2P", monospace',
                  background: '#0f3460',
                  border: '4px solid #16213e',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                fontSize: '8px',
                color: '#666',
                marginTop: '5px'
              }}>
                Si eres monitor, introduce el código secreto
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              background: '#e94560',
              color: '#fff',
              padding: '10px',
              fontSize: '10px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '14px',
              fontFamily: '"Press Start 2P", monospace',
              background: isLoading ? '#666' : '#e94560',
              color: '#fff',
              border: '4px solid #16213e',
              boxShadow: '4px 4px 0px #0f0f23',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'CARGANDO...' : (isLogin ? 'ENTRAR' : 'REGISTRAR')}
          </button>
        </form>

        {/* Toggle login/register */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d4ff',
              fontSize: '10px',
              fontFamily: '"Press Start 2P", monospace',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

