/**
 * QrCameraScannerModal Component (React / JSX)
 * Live camera QR code scanner powered by jsQR with zero soft-keyboard popups.
 * Designed for mobile phones, tablets, and handheld devices used by transit personnel.
 */
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { createPassengerQrPayload, generateDailyTripId } from '@shared/qrPassUtils';

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (_) {}
}

export function QrCameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Commuter QR Pass'
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [scanSuccessText, setScanSuccessText] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(false);
  const animationFrameRef = useRef(null);

  // Ensure soft keyboard is dismissed whenever the scanner modal is open
  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setScanSuccessText(null);
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by this browser. Please use HTTPS or a modern browser.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
        setCameraActive(true);
        isScanningRef.current = true;
        startDecodingLoop();
      }
    } catch (err) {
      console.warn('Camera start error:', err);
      // Fallback without facingMode constraint if ideal environment failed
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          await videoRef.current.play();
          setCameraActive(true);
          isScanningRef.current = true;
          startDecodingLoop();
          return;
        }
      } catch (fallbackErr) {
        setCameraError(fallbackErr.message || 'Unable to access camera. Check device camera permissions.');
      }
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startDecodingLoop = () => {
    const scanFrame = () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= video.HAVE_CURRENT_DATA && canvas) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data && String(code.data).trim()) {
              handleDetectedCode(String(code.data).trim());
              return;
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const dismissKeyboard = () => {
    if (typeof document !== 'undefined') {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
    }
  };

  const handleDetectedCode = (decodedText) => {
    isScanningRef.current = false;
    playBeep();
    setScanSuccessText('QR Code Read Successfully!');
    dismissKeyboard();

    if (onScan) {
      onScan(decodedText);
    }

    setTimeout(() => {
      dismissKeyboard();
      onClose();
    }, 500);
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const simulateScanPass = (category = 'Regular', count = 1, toStop = 'Mindanao Avenue corner Congressional Avenue') => {
    const payload = createPassengerQrPayload({
      tripId: generateDailyTripId(),
      category,
      count,
      boardingStop: 'Quezon City Hall – NHA Interchange',
      destinationStop: toStop,
      direction: 'Northbound',
      busPlate: 'QC-BUS'
    });
    handleDetectedCode(payload);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    dismissKeyboard();
    playBeep();
    if (onScan) {
      onScan(clean);
    }
    dismissKeyboard();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(500px, 100%)',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scanner"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '.25rem',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Viewport Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '280px',
            backgroundColor: '#020617',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(6, 182, 212, 0.3)'
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Viewfinder Target Overlay */}
          {cameraActive && !scanSuccessText && (
            <div
              style={{
                position: 'absolute',
                width: '210px',
                height: '210px',
                border: '2px solid rgba(6, 182, 212, 0.85)',
                borderRadius: '4px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#06b6d4'
                }}
              />
            </div>
          )}

          {/* Success Overlay */}
          {scanSuccessText && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(16, 185, 129, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                gap: '.5rem',
                zIndex: 10
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success</span>
              <strong style={{ fontSize: '1.1rem' }}>{scanSuccessText}</strong>
            </div>
          )}

          {/* Error Message */}
          {cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#f87171',
                gap: '.5rem'
              }}
            >
              <strong style={{ fontSize: '.95rem' }}>Camera unavailable</strong>
              <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{cameraError}</span>
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-secondary"
                style={{ marginTop: '.5rem', fontSize: '.8rem', padding: '.4rem .8rem' }}
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Camera Controls & Instruction */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>
            Aim camera at commuter QR pass
          </span>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="btn btn-secondary"
              style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
            >
              Flip Camera
            </button>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="btn btn-secondary"
              style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
            >
              {showManual ? 'Hide Manual' : 'Type Code'}
            </button>
          </div>
        </div>

        {/* Quick Test Pass Simulation Buttons for Desktop / Testing */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          padding: '0.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '4px',
          border: '1px dashed #334155'
        }}>
          <span style={{ fontSize: '.7rem', color: '#94a3b8', fontWeight: 700 }}>
            Quick Test QR Passes (Click to Simulate Scan):
          </span>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => simulateScanPass('Regular', 1, 'Mindanao Avenue corner Congressional Avenue')}
              className="btn btn-secondary"
              style={{ fontSize: '.72rem', padding: '.25rem .55rem', backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: '#06b6d4', color: '#38bdf8' }}
            >
              + Regular (Stop 1 → Stop 5)
            </button>
            <button
              type="button"
              onClick={() => simulateScanPass('Senior Citizen', 1, 'Quirino Highway – SM City Novaliches')}
              className="btn btn-secondary"
              style={{ fontSize: '.72rem', padding: '.25rem .55rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', color: '#fbbf24' }}
            >
              + Priority Senior (Stop 1 → Stop 11)
            </button>
            <button
              type="button"
              onClick={() => simulateScanPass('Regular', 3, 'General Luis Avenue corner SB Road')}
              className="btn btn-secondary"
              style={{ fontSize: '.72rem', padding: '.25rem .55rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#34d399' }}
            >
              + Group 3 pax (Stop 1 → Stop 15)
            </button>
          </div>
        </div>

        {/* Optional Manual Entry (only opened if conductor explicitly clicks 'Type Code') */}
        {showManual && (
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem' }}>
            <input
              type="text"
              className="form-input"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter pass ID or JSON payload..."
              style={{ fontSize: '.85rem', flex: 1 }}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '.45rem .85rem', fontSize: '.82rem' }}>
              Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
