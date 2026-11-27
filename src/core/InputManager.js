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

    // Analog steering (-1 right to +1 left in right-handed Three.js coordinates)
    this.touchSteerAngle = 0;
    this.isTouchSteering = false;
    this.steerTouchId = null;
    this.mobileBound = false;

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
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => this.setupMobileDOMBindings(), { once: true });
    } else {
      this.setupMobileDOMBindings();
    }
  }

  setupMobileDOMBindings() {
    if (this.mobileBound || typeof document === 'undefined') return;
    this.mobileBound = true;

    // Detect touch-capable devices even if mobile browser requests "Desktop site"
    const hasTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0);
    if (hasTouch && document.body) {
      document.body.classList.add('is-touch-device');
    }

    const bindHoldButton = (id, keyName) => {
      const el = document.getElementById(id);
      if (!el) return;

      const activeTouches = new Set();
      let mouseHeld = false;

      const syncState = () => {
        const isPressed = activeTouches.size > 0 || mouseHeld;
        this.keys[keyName] = isPressed;
        el.classList.toggle('active', isPressed);
      };

      el.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        if (e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            activeTouches.add(e.changedTouches[i].identifier);
          }
        } else {
          activeTouches.add('default');
        }
        syncState();
      }, { passive: false });

      const releaseTouches = (e) => {
        if (e.cancelable) e.preventDefault();
        if (e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            activeTouches.delete(e.changedTouches[i].identifier);
          }
        } else {
          activeTouches.clear();
        }
        syncState();
      };

      el.addEventListener('touchend', releaseTouches, { passive: false });
      el.addEventListener('touchcancel', releaseTouches, { passive: false });

      // Support mouse click-and-hold when testing touch UI on desktop
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        mouseHeld = true;
        if (el.setPointerCapture && e.pointerId !== undefined) {
          try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        syncState();
      });

      const releaseMouse = (e) => {
        if (e.pointerType === 'touch') return;
        mouseHeld = false;
        syncState();
      };

      el.addEventListener('pointerup', releaseMouse);
      el.addEventListener('pointercancel', releaseMouse);
      el.addEventListener('lostpointercapture', releaseMouse);
    };

    bindHoldButton('btn-touch-accel', 'forward');
    bindHoldButton('btn-touch-brake', 'backward');
    bindHoldButton('btn-touch-handbrake', 'handbrake');
    bindHoldButton('btn-touch-nitro', 'nitro');
    bindHoldButton('btn-touch-left', 'left');
    bindHoldButton('btn-touch-right', 'right');

    // Multi-touch independent steering wheel pad (works simultaneously while right thumb holds ACCEL)
    const wheelZone = document.getElementById('touch-steer-wheel');
    const wheelGraphic = document.getElementById('touch-wheel-graphic');
    if (wheelZone) {
      const handleSteerMove = (clientX) => {
        const rect = wheelZone.getBoundingClientRect();
        const width = rect.width || 120;
        const centerX = rect.left + width * 0.5;
        const maxOffset = width * 0.45;
        const delta = Math.max(-1, Math.min(1, (clientX - centerX) / maxOffset));
        this.touchSteerAngle = Math.abs(delta) < 0.06 ? 0 : -delta;
        if (wheelGraphic) {
          wheelGraphic.style.transform = `rotate(${delta * 65}deg)`;
        }
      };

      wheelZone.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : null);
        if (!touch) return;
        this.steerTouchId = touch.identifier;
        this.isTouchSteering = true;
        handleSteerMove(touch.clientX);
      }, { passive: false });

      wheelZone.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
        if (!this.isTouchSteering || !e.touches) return;
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.identifier === this.steerTouchId) {
            handleSteerMove(t.clientX);
            break;
          }
        }
      }, { passive: false });

      const stopSteer = (e) => {
        if (e.cancelable) e.preventDefault();
        if (e.changedTouches && this.steerTouchId !== null) {
          let released = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.steerTouchId) {
              released = true;
              break;
            }
          }
          if (!released) return;
        }
        this.steerTouchId = null;
        this.isTouchSteering = false;
        this.touchSteerAngle = 0;
        if (wheelGraphic) {
          wheelGraphic.style.transform = 'rotate(0deg)';
        }
      };

      wheelZone.addEventListener('touchend', stopSteer, { passive: false });
      wheelZone.addEventListener('touchcancel', stopSteer, { passive: false });

      // Mouse drag fallback on desktop when On-Screen Touch Controls = Always Show
      let wheelMouseDown = false;
      wheelZone.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        wheelMouseDown = true;
        this.isTouchSteering = true;
        if (wheelZone.setPointerCapture && e.pointerId !== undefined) {
          try { wheelZone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        handleSteerMove(e.clientX);
      });
      wheelZone.addEventListener('pointermove', (e) => {
        if (!wheelMouseDown || e.pointerType === 'touch') return;
        handleSteerMove(e.clientX);
      });
      const endWheelMouse = (e) => {
        if (!wheelMouseDown || e.pointerType === 'touch') return;
        wheelMouseDown = false;
        this.isTouchSteering = false;
        this.touchSteerAngle = 0;
        if (wheelGraphic) wheelGraphic.style.transform = 'rotate(0deg)';
      };
      wheelZone.addEventListener('pointerup', endWheelMouse);
      wheelZone.addEventListener('pointercancel', endWheelMouse);
    }

    const bindTapButton = (id, getCb) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let lastTouchTs = 0;
      btn.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        lastTouchTs = Date.now();
        const cb = getCb();
        if (cb) cb();
      }, { passive: false });
      btn.addEventListener('click', (e) => {
        if (Date.now() - lastTouchTs < 450) return;
        e.preventDefault();
        const cb = getCb();
        if (cb) cb();
      });
    };

    bindTapButton('btn-touch-camera', () => this.callbacks.onCameraToggle);
    bindTapButton('btn-touch-reset', () => this.callbacks.onResetCar);
    bindTapButton('btn-touch-pause', () => this.callbacks.onPauseToggle);
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
    this.steerTouchId = null;
  }
}
