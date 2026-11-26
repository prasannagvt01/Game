export class InputManager {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      nitro: false,
      lookBack: false
    };

    // Analog steering (-1 left to +1 right) for mobile touch wheel or smooth keyboard interpolation
    this.touchSteerAngle = 0;
    this.isTouchSteering = false;
    this.touchWheelStartX = 0;

    this.callbacks = {
      onCameraToggle: null,
      onPauseToggle: null,
      onResetCar: null,
      onHorn: null
    };

    this._bindKeyboard();
    this._bindMobileTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const code = e.code;

      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.handbrake = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.keys.nitro = true;
          break;
        case 'KeyB':
          this.keys.lookBack = true;
          break;
        case 'KeyC':
          if (!e.repeat && this.callbacks.onCameraToggle) {
            this.callbacks.onCameraToggle();
          }
          break;
        case 'KeyR':
          if (!e.repeat && this.callbacks.onResetCar) {
            this.callbacks.onResetCar();
          }
          break;
        case 'KeyH':
          if (!e.repeat && this.callbacks.onHorn) {
            this.callbacks.onHorn();
          }
          break;
        case 'Escape':
        case 'KeyP':
          if (!e.repeat && this.callbacks.onPauseToggle) {
            this.callbacks.onPauseToggle();
          }
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.handbrake = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.keys.nitro = false;
          break;
        case 'KeyB':
          this.keys.lookBack = false;
          break;
      }
    });

    window.addEventListener('blur', () => {
      this.resetAllInputs();
    });
  }

  _bindMobileTouch() {
    window.addEventListener('DOMContentLoaded', () => {
      this.setupMobileDOMBindings();
    });
  }

  setupMobileDOMBindings() {
    const bindHoldButton = (id, keyName) => {
      const el = document.getElementById(id);
      if (!el) return;

      const start = (e) => {
        e.preventDefault();
        this.keys[keyName] = true;
        el.classList.add('active');
      };
      const end = (e) => {
        e.preventDefault();
        this.keys[keyName] = false;
        el.classList.remove('active');
      };

      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointerleave', end);
    };

    bindHoldButton('btn-touch-accel', 'forward');
    bindHoldButton('btn-touch-brake', 'backward');
    bindHoldButton('btn-touch-handbrake', 'handbrake');
    bindHoldButton('btn-touch-nitro', 'nitro');
    bindHoldButton('btn-touch-left', 'left');
    bindHoldButton('btn-touch-right', 'right');

    // Interactive touch steering wheel pad
    const wheelZone = document.getElementById('touch-steer-wheel');
    const wheelGraphic = document.getElementById('touch-wheel-graphic');
    if (wheelZone) {
      const handleSteerMove = (clientX) => {
        const rect = wheelZone.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const maxOffset = rect.width * 0.45;
        const delta = Math.max(-1, Math.min(1, (clientX - centerX) / maxOffset));
        // Deadzone
        this.touchSteerAngle = Math.abs(delta) < 0.06 ? 0 : -delta;
        if (wheelGraphic) {
          wheelGraphic.style.transform = `rotate(${delta * 65}deg)`;
        }
      };

      wheelZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isTouchSteering = true;
        if (e.touches.length > 0) handleSteerMove(e.touches[0].clientX);
      }, { passive: false });

      wheelZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!this.isTouchSteering) return;
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.clientX < window.innerWidth * 0.5) {
            handleSteerMove(t.clientX);
            break;
          }
        }
      }, { passive: false });

      const stopSteer = (e) => {
        e.preventDefault();
        this.isTouchSteering = false;
        this.touchSteerAngle = 0;
        if (wheelGraphic) {
          wheelGraphic.style.transform = 'rotate(0deg)';
        }
      };

      wheelZone.addEventListener('touchend', stopSteer, { passive: false });
      wheelZone.addEventListener('touchcancel', stopSteer, { passive: false });
    }

    const camBtn = document.getElementById('btn-touch-camera');
    if (camBtn) {
      camBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onCameraToggle) this.callbacks.onCameraToggle();
      });
    }

    const resetBtn = document.getElementById('btn-touch-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onResetCar) this.callbacks.onResetCar();
      });
    }

    const pauseBtn = document.getElementById('btn-touch-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onPauseToggle) this.callbacks.onPauseToggle();
      });
    }
  }

  getThrottle() {
    return this.keys.forward ? 1 : 0;
  }

  getBrake() {
    return this.keys.backward ? 1 : 0;
  }

  /**
   * Returns steering target from -1 (right) to +1 (left) in right-handed Three.js coordinates
   */
  getSteerInput() {
    if (this.isTouchSteering && Math.abs(this.touchSteerAngle) > 0.01) {
      return this.touchSteerAngle;
    }
    let steer = 0;
    if (this.keys.left) steer += 1;
    if (this.keys.right) steer -= 1;
    return steer;
  }

  resetAllInputs() {
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
    this.touchSteerAngle = 0;
    this.isTouchSteering = false;
  }
}
