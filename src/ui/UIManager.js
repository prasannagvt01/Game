import {
  CAR_CATALOG,
  UPGRADE_CONFIG,
  PAINT_SWATCHES,
  WHEEL_STYLES,
  SPOILER_STYLES,
  SUSPENSION_STANCES,
  getCarById,
  getManufacturersList,
  getUpgradeCost,
  computeEffectiveSpecs,
  previewUpgradeSpecs
} from '../vehicles/CarCatalog.js';
import { GAME_MODES } from '../modes/RaceManager.js';
import { MISSION_CATALOG, getMissionById } from '../modes/MissionCatalog.js';

export class UIManager {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.save = gameEngine.saveManager;

    this.selectedModeId = 'circuit';
    this.selectedMissionId = MISSION_CATALOG[0].id;
    this.selectedManufacturer = 'ALL';
    this.garagePreviewCarId = getCarById(this.save.getSelectedCarId()).id;
    this.pendingPurchaseCallback = null;
    this.toastTimeout = null;

    this.screens = {
      mainMenu: document.getElementById('screen-main-menu'),
      multiplayer: document.getElementById('screen-multiplayer'),
      missions: document.getElementById('screen-missions'),
      garage: document.getElementById('screen-garage'),
      settings: document.getElementById('modal-settings'),
      pause: document.getElementById('modal-pause'),
      results: document.getElementById('modal-results'),
      confirmModal: document.getElementById('modal-purchase-confirm'),
      resetConfirmModal: document.getElementById('modal-reset-confirm'),
      hud: document.getElementById('hud-overlay')
    };

    // Refresh UI when IndexedDB async profile synchronization completes
    this.save.onSaveSynced = () => {
      this.garagePreviewCarId = getCarById(this.save.getSelectedCarId()).id;
      this._syncSettingsControls();
      this.refreshMainMenu();
      this.refreshCreditsDisplay();
    };

    this._initMainMenu();
    this._initMultiplayerScreen();
    this._initMissionsScreen();
    this._initGarage();
    this._initSettings();
    this._initPauseAndResults();
    this._initHUDButtons();
    this.refreshCreditsDisplay();
  }

  showScreen(name) {
    const hideAllMain = () => {
      this.screens.mainMenu?.classList.add('hidden');
      this.screens.multiplayer?.classList.add('hidden');
      this.screens.missions?.classList.add('hidden');
      this.screens.garage?.classList.add('hidden');
      this.screens.hud?.classList.add('hidden');
    };

    if (name === 'mainMenu') {
      hideAllMain();
      this.screens.mainMenu.classList.remove('hidden');
      this.screens.pause.classList.add('hidden');
      this.screens.results.classList.add('hidden');
      this.refreshMainMenu();
    } else if (name === 'multiplayer') {
      hideAllMain();
      this.screens.multiplayer?.classList.remove('hidden');
      this.screens.pause.classList.add('hidden');
      this.screens.results.classList.add('hidden');
      this.renderMultiplayerLobby();
    } else if (name === 'missions') {
      hideAllMain();
      this.screens.missions?.classList.remove('hidden');
      this.renderMissionsUI();
    } else if (name === 'garage') {
      hideAllMain();
      this.screens.garage.classList.remove('hidden');
      this.garagePreviewCarId = this.save.getSelectedCarId();
      this.renderGarageUI();
    } else if (name === 'hud') {
      hideAllMain();
      this.screens.hud.classList.remove('hidden');
      this.screens.pause.classList.add('hidden');
      this.screens.results.classList.add('hidden');
    }
    this.refreshCreditsDisplay();
  }

  refreshCreditsDisplay() {
    const credits = `$${this.save.getCredits().toLocaleString()}`;
    document.querySelectorAll('.credits-amount').forEach((el) => {
      el.textContent = credits;
    });
  }

  showGarageToast(message, tone = 'green') {
    const toast = document.getElementById('garage-confirm-toast');
    if (!toast) return;
    toast.textContent = String(message).replace(/^[✓\s]+/, '');
    toast.classList.remove('tone-white', 'tone-cyan', 'tone-green');
    toast.classList.add(`tone-${tone}`, 'visible');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  }

  openPurchaseConfirmation({ title, itemLabel, gainSummary, cost, onConfirm }) {
    const modal = this.screens.confirmModal;
    if (!modal) {
      if (onConfirm) onConfirm();
      return;
    }

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-item').textContent = itemLabel;
    document.getElementById('confirm-modal-gain').textContent = gainSummary;
    document.getElementById('confirm-modal-cost').textContent = `$${cost.toLocaleString()}`;
    const remaining = Math.max(0, this.save.getCredits() - cost);
    document.getElementById('confirm-modal-balance').textContent = `$${remaining.toLocaleString()}`;

    this.pendingPurchaseCallback = onConfirm;
    modal.classList.remove('hidden');
  }

  _initMainMenu() {
    const modeGrid = document.getElementById('mode-selector-grid');
    if (modeGrid) {
      modeGrid.innerHTML = '';
      Object.values(GAME_MODES).forEach((m) => {
        const card = document.createElement('div');
        card.className = `mode-card ${m.id === this.selectedModeId ? 'selected' : ''}`;
        card.dataset.mode = m.id;
        card.innerHTML = `
          <div class="mode-card-header">
            <span class="mode-icon">${m.icon}</span>
            <span class="mode-title">${m.name}</span>
          </div>
          <p class="mode-desc">${m.subtitle}</p>
        `;
        card.addEventListener('click', () => {
          this.selectedModeId = m.id;
          document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
        });
        modeGrid.appendChild(card);
      });
    }

    document.getElementById('btn-menu-play')?.addEventListener('click', () => {
      this.engine.startRaceMode(this.selectedModeId);
    });

    document.getElementById('btn-menu-multiplayer')?.addEventListener('click', () => {
      this.engine.enterMultiplayerLobby();
    });

    document.getElementById('btn-menu-missions')?.addEventListener('click', () => {
      this.engine.enterMissionsScreen();
    });

    document.getElementById('btn-menu-quickdrive')?.addEventListener('click', () => {
      this.selectedModeId = 'freeroam';
      this.engine.startRaceMode('freeroam');
    });

    document.getElementById('btn-menu-garage')?.addEventListener('click', () => {
      this.engine.enterGarage();
    });

    document.getElementById('btn-menu-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    const currentDiff = this.save.getSettings().aiDifficulty || 'medium';
    document.querySelectorAll('.diff-pill-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === currentDiff);
      btn.addEventListener('click', () => {
        const diff = btn.dataset.diff;
        this.save.updateSetting('aiDifficulty', diff);
        document.querySelectorAll('.diff-pill-btn').forEach((b) => b.classList.toggle('active', b.dataset.diff === diff));
        const sel = document.getElementById('setting-ai-difficulty');
        if (sel) sel.value = diff;
      });
    });
  }

  refreshMainMenu() {
    const activeCar = getCarById(this.save.getSelectedCarId());
    const upgrades = this.save.getCarUpgrades(activeCar.id);
    const eff = computeEffectiveSpecs(activeCar, upgrades);
    const badge = document.getElementById('menu-current-car-name');
    if (badge) badge.textContent = `${activeCar.name} [${eff.piClass} ${eff.piRating}]`;
    this.refreshCreditsDisplay();
  }

  _initMultiplayerScreen() {
    const mp = this.engine.multiplayerManager;
    if (!mp) return;

    const nameInput = document.getElementById('mp-player-name');
    const serverInput = document.getElementById('mp-server-url');
    const codeInput = document.getElementById('mp-join-code');
    const lapsSelect = document.getElementById('mp-laps-select');

    if (nameInput) {
      const savedName = mp.getSavedPlayerName();
      if (savedName) nameInput.value = savedName;
      nameInput.addEventListener('change', () => {
        const clean = mp.setSavedPlayerName(nameInput.value);
        nameInput.value = clean;
        mp.syncProfile(clean);
      });
    }

    if (serverInput) {
      serverInput.value = mp.getCustomServerUrl();
      serverInput.addEventListener('change', () => {
        mp.setCustomServerUrl(serverInput.value);
      });
    }

    if (codeInput) {
      codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 4);
        this.hideMultiplayerError();
      });
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('btn-mp-join')?.click();
        }
      });
    }

    if (lapsSelect) {
      lapsSelect.addEventListener('change', () => {
        if (mp.isHost) {
          mp.syncProfile(nameInput?.value || null, Number(lapsSelect.value));
        }
      });
    }

    document.getElementById('btn-mp-back')?.addEventListener('click', () => {
      if (mp.isInRoom()) {
        mp.leaveRoom(true);
      }
      this.returnFromGarageToMultiplayer = false;
      this.engine.returnToMainMenu();
    });

    document.getElementById('btn-mp-change-car')?.addEventListener('click', () => {
      this.returnFromGarageToMultiplayer = true;
      this.engine.enterGarage();
    });

    document.getElementById('btn-mp-create')?.addEventListener('click', () => {
      this.hideMultiplayerError();
      mp.createRoom(nameInput?.value || 'Player 1', serverInput?.value ?? null);
    });

    document.getElementById('btn-mp-join')?.addEventListener('click', () => {
      this.hideMultiplayerError();
      const entered = codeInput ? codeInput.value.trim() : '';
      mp.joinRoom(entered, nameInput?.value || 'Player 2', serverInput?.value ?? null);
    });

    document.getElementById('btn-mp-copy-code')?.addEventListener('click', async () => {
      if (!mp.roomCode) return;
      const copyBtn = document.getElementById('btn-mp-copy-code');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(mp.roomCode);
        }
      } catch { /* fallback still shows visual confirmation */ }
      if (copyBtn) {
        copyBtn.textContent = '✓ COPIED!';
        setTimeout(() => {
          if (copyBtn) copyBtn.textContent = '📋 COPY CODE';
        }, 1800);
      }
    });

    document.getElementById('btn-mp-start-race')?.addEventListener('click', () => {
      const laps = Number(lapsSelect?.value || 2);
      mp.requestStartRace(laps);
    });

    document.getElementById('btn-mp-leave-room')?.addEventListener('click', () => {
      this.hideMultiplayerError();
      mp.leaveRoom(true);
      this.renderMultiplayerLobby();
    });

    mp.onRoomUpdate = () => {
      this.hideMultiplayerError();
      this.renderMultiplayerLobby();
    };

    mp.onError = (_code, message) => {
      this.showMultiplayerError(message);
      this.renderMultiplayerLobby();
    };

    mp.onConnectionChange = () => {
      this.renderMultiplayerLobby();
    };
  }

  showMultiplayerError(message) {
    const errEl = document.getElementById('mp-error-banner');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  }

  hideMultiplayerError() {
    document.getElementById('mp-error-banner')?.classList.add('hidden');
  }

  renderMultiplayerLobby() {
    const mp = this.engine.multiplayerManager;
    if (!mp) return;

    const activeCar = getCarById(this.save.getSelectedCarId());
    const carBadge = document.getElementById('mp-active-car-name');
    if (carBadge) carBadge.textContent = activeCar.name;

    const connBadge = document.getElementById('mp-conn-status');
    if (connBadge) {
      const stateMap = {
        disconnected: '● READY',
        connecting: '◌ CONNECTING...',
        connected: '● ONLINE',
        reconnecting: '◌ RECONNECTING...'
      };
      connBadge.textContent = stateMap[mp.connectionState] || '● READY';
      connBadge.className = `pill-value mp-conn-badge ${mp.connectionState}`;
    }

    const entryView = document.getElementById('mp-entry-view');
    const roomView = document.getElementById('mp-room-view');
    const inRoom = mp.isInRoom();

    entryView?.classList.toggle('hidden', inRoom);
    roomView?.classList.toggle('hidden', !inRoom);

    if (!inRoom || !mp.room) return;

    const room = mp.room;
    const codeVal = document.getElementById('mp-room-code-val');
    if (codeVal) codeVal.textContent = room.code;

    const lapsSelect = document.getElementById('mp-laps-select');
    if (lapsSelect) {
      lapsSelect.value = String(room.laps || 2);
      lapsSelect.disabled = !mp.isHost;
    }

    const p1 = room.players.find((p) => p.slot === 1) || room.players[0] || null;
    const p2 = room.players.find((p) => p.slot === 2) || (room.players.length > 1 ? room.players[1] : null);

    const fillSlot = (slotNum, playerObj) => {
      const card = document.getElementById(`mp-slot-${slotNum}`);
      const roleEl = document.getElementById(`mp-p${slotNum}-role`);
      const nameEl = document.getElementById(`mp-p${slotNum}-name`);
      const swatchEl = document.getElementById(`mp-p${slotNum}-swatch`);
      const carEl = document.getElementById(`mp-p${slotNum}-car`);
      const statusEl = document.getElementById(`mp-p${slotNum}-status`);

      if (!playerObj) {
        card?.classList.add('waiting');
        if (roleEl) {
          roleEl.textContent = 'OPEN SLOT';
          roleEl.className = 'mp-role-pill';
        }
        if (nameEl) nameEl.textContent = 'Waiting for friend...';
        if (swatchEl) swatchEl.style.backgroundColor = 'transparent';
        if (carEl) carEl.textContent = `Share code ${room.code} to invite`;
        if (statusEl) {
          statusEl.textContent = '○ Waiting (1 / 2 Players)';
          statusEl.className = 'mp-slot-status';
        }
        return;
      }

      card?.classList.remove('waiting');
      const isMe = playerObj.id === mp.playerId;
      const cDef = getCarById(playerObj.carId);
      if (roleEl) {
        roleEl.textContent = playerObj.isHost ? 'HOST' : 'PLAYER 2';
        roleEl.className = `mp-role-pill ${playerObj.isHost ? 'host' : 'guest'}`;
      }
      if (nameEl) nameEl.textContent = `${playerObj.name}${isMe ? ' (You)' : ''}`;
      if (swatchEl) swatchEl.style.backgroundColor = playerObj.color || cDef.defaultColor;
      if (carEl) carEl.textContent = cDef.name;
      if (statusEl) {
        statusEl.textContent = playerObj.connected ? '● Connected & Ready' : '◌ Reconnecting...';
        statusEl.className = `mp-slot-status ${playerObj.connected ? 'online' : 'warn'}`;
      }
    };

    fillSlot(1, p1);
    fillSlot(2, p2);

    const connectedCount = room.players.filter((p) => p.connected).length;
    const bothReady = connectedCount === 2;
    const waitMsg = document.getElementById('mp-waiting-msg');
    if (waitMsg) {
      if (!bothReady) {
        waitMsg.textContent = `Waiting for Player 2 to join using 4-digit room code ${room.code}...`;
        waitMsg.className = 'mp-waiting-banner';
      } else if (mp.isHost) {
        waitMsg.textContent = 'Both players connected (2 / 2)! Click Start Race to launch.';
        waitMsg.className = 'mp-waiting-banner ready';
      } else {
        waitMsg.textContent = 'Both players connected (2 / 2)! Waiting for the Host to start the race...';
        waitMsg.className = 'mp-waiting-banner ready';
      }
    }

    const startBtn = document.getElementById('btn-mp-start-race');
    if (startBtn) {
      startBtn.disabled = !(mp.isHost && bothReady);
      startBtn.textContent = mp.isHost
        ? (bothReady ? '🏁 START RACE' : '⏳ WAITING FOR PLAYER 2')
        : '⏳ WAITING FOR HOST TO START';
    }
  }

  syncMultiplayerPauseButtons(isMultiplayerRace) {
    document.getElementById('btn-pause-restart')?.classList.toggle('hidden', isMultiplayerRace);
    document.getElementById('btn-pause-garage')?.classList.toggle('hidden', isMultiplayerRace);
    document.getElementById('btn-pause-menu')?.classList.toggle('hidden', isMultiplayerRace);
    document.getElementById('btn-pause-leave-mp')?.classList.toggle('hidden', !isMultiplayerRace);
  }

  _initMissionsScreen() {
    document.getElementById('btn-missions-back')?.addEventListener('click', () => {
      this.engine.returnToMainMenu();
    });

    document.getElementById('btn-mission-launch')?.addEventListener('click', () => {
      this.engine.startMissionMode(this.selectedMissionId);
    });
  }

  renderMissionsUI() {
    this.refreshCreditsDisplay();
    const completedCount = this.save.getCompletedMissionsCount();
    const summaryEl = document.getElementById('missions-completion-summary');
    if (summaryEl) {
      summaryEl.textContent = `${completedCount} / ${MISSION_CATALOG.length} COMPLETED`;
    }

    const grid = document.getElementById('mission-cards-grid');
    if (grid) {
      grid.innerHTML = '';
      MISSION_CATALOG.forEach((m) => {
        const isDone = this.save.isMissionCompleted(m.id);
        const card = document.createElement('div');
        card.className = `mission-card ${m.id === this.selectedMissionId ? 'selected' : ''} ${isDone ? 'completed' : ''}`;
        card.dataset.missionId = m.id;
        card.innerHTML = `
          <div class="msn-card-top">
            <span class="msn-type-chip">${m.icon} ${m.typeLabel}</span>
            <span class="msn-diff-badge ${m.difficulty.toLowerCase()}">${m.difficulty.toUpperCase()}</span>
          </div>
          <h4 class="msn-card-title">${m.title}</h4>
          <p class="msn-card-obj">${m.objective}</p>
          <div class="msn-card-footer">
            <span class="msn-reward-tag">+$${m.reward.toLocaleString()}</span>
            <span class="msn-done-badge ${isDone ? 'done' : ''}">${isDone ? '✓ COMPLETED' : 'AVAILABLE'}</span>
          </div>
        `;
        card.addEventListener('click', () => {
          this.selectedMissionId = m.id;
          this.renderMissionsUI();
        });
        grid.appendChild(card);
      });
    }

    // Populate selected mission details panel
    const sel = getMissionById(this.selectedMissionId);
    const isSelDone = this.save.isMissionCompleted(sel.id);
    const rec = this.save.getMissionRecord(sel.id);

    document.getElementById('msn-detail-type').textContent = `${sel.icon} ${sel.typeLabel}`;
    const diffEl = document.getElementById('msn-detail-difficulty');
    if (diffEl) {
      diffEl.textContent = sel.difficulty.toUpperCase();
      diffEl.className = `msn-diff-badge ${sel.difficulty.toLowerCase()}`;
    }
    document.getElementById('msn-detail-title').textContent = sel.title;
    const statusEl = document.getElementById('msn-detail-status');
    if (statusEl) {
      statusEl.textContent = isSelDone
        ? `✓ COMPLETED (${rec?.summaryText || 'Done'})`
        : 'STATUS: AVAILABLE CONTRACT';
      statusEl.className = `msn-status-pill ${isSelDone ? 'done' : ''}`;
    }
    document.getElementById('msn-detail-desc').textContent = sel.description;
    document.getElementById('msn-detail-objective').textContent = sel.objective;
    document.getElementById('msn-detail-reward').textContent = `+$${sel.reward.toLocaleString()}`;
  }

  _initGarage() {
    document.getElementById('btn-garage-back')?.addEventListener('click', () => {
      if (this.returnFromGarageToMultiplayer) {
        this.returnFromGarageToMultiplayer = false;
        if (this.engine.garageCarMesh) this.engine.garageCarMesh.root.visible = false;
        this.engine.spawnActivePlayerCar();
        this.engine.multiplayerManager?.syncProfile();
        this.engine.enterMultiplayerLobby();
      } else {
        this.engine.leaveGarageToMenu();
      }
    });

    document.getElementById('btn-garage-race')?.addEventListener('click', () => {
      if (this.save.isCarUnlocked(this.garagePreviewCarId)) {
        this.save.setSelectedCarId(this.garagePreviewCarId);
      }
      this.engine.startRaceMode(this.selectedModeId);
    });

    document.getElementById('btn-garage-action')?.addEventListener('click', () => {
      const car = getCarById(this.garagePreviewCarId);
      if (this.save.isCarUnlocked(car.id)) {
        this.save.setSelectedCarId(car.id);
        this.engine.spawnActivePlayerCar();
        this.showGarageToast(`${car.name} equipped`, 'green');
        this.renderGarageUI();
      } else if (this.save.getCredits() >= car.price) {
        const eff = computeEffectiveSpecs(car);
        this.openPurchaseConfirmation({
          title: 'CONFIRM VEHICLE PURCHASE',
          itemLabel: `${car.name} (${car.category})`,
          gainSummary: `Class ${eff.piClass} • PI ${eff.piRating} • ${eff.topSpeedKmh} km/h Top Speed`,
          cost: car.price,
          onConfirm: () => {
            if (this.save.purchaseCar(car.id, car.price)) {
              this.engine.audioManager.playCheckpointChime();
              this.engine.spawnActivePlayerCar();
              this.showGarageToast(`Purchased ${car.name}`, 'green');
              this.renderGarageUI();
            }
          }
        });
      }
    });

    document.getElementById('btn-sponsor-grant')?.addEventListener('click', () => {
      this.save.addCredits(25000);
      this.engine.audioManager.playCheckpointChime();
      this.showGarageToast('Sponsor bonus • +$25,000', 'green');
      this.renderGarageUI();
    });

    // Purchase Confirmation Modal Yes / No buttons
    document.getElementById('btn-confirm-purchase-yes')?.addEventListener('click', () => {
      this.screens.confirmModal?.classList.add('hidden');
      if (this.pendingPurchaseCallback) {
        const fn = this.pendingPurchaseCallback;
        this.pendingPurchaseCallback = null;
        fn();
      }
    });

    document.getElementById('btn-confirm-purchase-no')?.addEventListener('click', () => {
      this.screens.confirmModal?.classList.add('hidden');
      this.pendingPurchaseCallback = null;
    });

    // Populate Visual Customization Selectors (Wheel Rims, Rear Aero Spoiler, Suspension Stance)
    const wheelSel = document.getElementById('garage-wheel-select');
    if (wheelSel) {
      wheelSel.innerHTML = WHEEL_STYLES.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
      wheelSel.addEventListener('change', () => {
        const car = getCarById(this.garagePreviewCarId);
        this.save.setCarCustomization(car.id, 'wheelStyle', wheelSel.value, car);
        this.engine.previewGarageCar(car.id);
        if (this.save.getSelectedCarId() === car.id) this.engine.spawnActivePlayerCar();
        this.renderGarageUI();
      });
    }

    const spoilerSel = document.getElementById('garage-spoiler-select');
    if (spoilerSel) {
      spoilerSel.innerHTML = SPOILER_STYLES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
      spoilerSel.addEventListener('change', () => {
        const car = getCarById(this.garagePreviewCarId);
        this.save.setCarCustomization(car.id, 'spoilerStyle', spoilerSel.value, car);
        this.engine.previewGarageCar(car.id);
        if (this.save.getSelectedCarId() === car.id) this.engine.spawnActivePlayerCar();
        this.renderGarageUI();
      });
    }

    const stanceSel = document.getElementById('garage-stance-select');
    if (stanceSel) {
      stanceSel.innerHTML = SUSPENSION_STANCES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
      stanceSel.addEventListener('change', () => {
        const car = getCarById(this.garagePreviewCarId);
        this.save.setCarCustomization(car.id, 'stance', stanceSel.value, car);
        this.engine.previewGarageCar(car.id);
        if (this.save.getSelectedCarId() === car.id) this.engine.spawnActivePlayerCar();
        this.renderGarageUI();
      });
    }
  }

  /**
   * Updates the 5 vehicle specification bars and live green Upgrade Preview deltas
   */
  updateGarageSpecBars(car, upgrades, previewStatKey = null) {
    const customization = this.save.getCarCustomization(car.id, car);
    const { currentSpecs, nextSpecs, deltas } = previewUpgradeSpecs(car, upgrades, previewStatKey, customization);

    // Update PI Badge
    const piBadge = document.getElementById('garage-pi-badge');
    if (piBadge) {
      if (deltas && deltas.piRating > 0) {
        piBadge.textContent = `CLASS ${nextSpecs.piClass} • PI ${currentSpecs.piRating} (+${deltas.piRating})`;
      } else {
        piBadge.textContent = `CLASS ${currentSpecs.piClass} • PI ${currentSpecs.piRating}`;
      }
    }

    const applyBar = (valId, deltaId, barId, prevId, currValText, deltaText, currPct, nextPct) => {
      const valEl = document.getElementById(valId);
      const deltaEl = document.getElementById(deltaId);
      const barEl = document.getElementById(barId);
      const prevEl = document.getElementById(prevId);

      if (valEl) valEl.textContent = currValText;
      if (deltaEl) {
        deltaEl.textContent = deltaText || '';
        deltaEl.classList.toggle('visible', Boolean(deltaText));
      }
      if (barEl) barEl.style.width = `${currPct}%`;
      if (prevEl) {
        const diffPct = Math.max(0, nextPct - currPct);
        prevEl.style.left = `${currPct}%`;
        prevEl.style.width = `${diffPct}%`;
      }
    };

    const speedCurrPct = Math.min(100, Math.round((currentSpecs.topSpeedKmh / 410) * 100));
    const speedNextPct = Math.min(100, Math.round((nextSpecs.topSpeedKmh / 410) * 100));
    applyBar(
      'stat-speed-val', 'stat-speed-delta', 'stat-speed-bar', 'stat-speed-preview',
      `${currentSpecs.topSpeedKmh} km/h`,
      deltas && deltas.topSpeedKmh > 0 ? `+${deltas.topSpeedKmh} km/h` : '',
      speedCurrPct, speedNextPct
    );

    const accelCurrPct = Math.min(100, Math.round((currentSpecs.engineForce / 26000) * 100));
    const accelNextPct = Math.min(100, Math.round((nextSpecs.engineForce / 26000) * 100));
    applyBar(
      'stat-accel-val', 'stat-accel-delta', 'stat-accel-bar', 'stat-accel-preview',
      `${Math.round(currentSpecs.engineForce / 100)} Nm`,
      deltas && deltas.engineForce > 0 ? `+${Math.max(1, Math.round(deltas.engineForce / 100))} Nm` : '',
      accelCurrPct, accelNextPct
    );

    const brakeCurrPct = Math.min(100, Math.round((currentSpecs.brakeForce / 36000) * 100));
    const brakeNextPct = Math.min(100, Math.round((nextSpecs.brakeForce / 36000) * 100));
    applyBar(
      'stat-brake-val', 'stat-brake-delta', 'stat-brake-bar', 'stat-brake-preview',
      `${Math.round(currentSpecs.brakeForce / 100)} kN`,
      deltas && deltas.brakeForce > 0 ? `+${Math.max(1, Math.round(deltas.brakeForce / 100))} kN` : '',
      brakeCurrPct, brakeNextPct
    );

    const handlCurrPct = Math.min(100, Math.round((currentSpecs.turnRate / 3.8) * 100));
    const handlNextPct = Math.min(100, Math.round((nextSpecs.turnRate / 3.8) * 100));
    applyBar(
      'stat-handl-val', 'stat-handl-delta', 'stat-handl-bar', 'stat-handl-preview',
      `${currentSpecs.turnRate.toFixed(2)} G`,
      deltas && deltas.turnRate > 0 ? `+${deltas.turnRate.toFixed(2)} G` : '',
      handlCurrPct, handlNextPct
    );

    const gripCurrPct = Math.min(100, currentSpecs.gripScore);
    const gripNextPct = Math.min(100, nextSpecs.gripScore);
    applyBar(
      'stat-grip-val', 'stat-grip-delta', 'stat-grip-bar', 'stat-grip-preview',
      `${currentSpecs.gripScore} / 100`,
      deltas && deltas.gripScore > 0 ? `+${deltas.gripScore}` : '',
      gripCurrPct, gripNextPct
    );
  }

  _formatUpgradeGainSummary(deltas) {
    if (!deltas) return 'Max Performance Stage';
    const parts = [];
    if (deltas.topSpeedKmh > 0) parts.push(`+${deltas.topSpeedKmh} km/h Speed`);
    if (deltas.engineForce > 0) parts.push(`+${Math.max(1, Math.round(deltas.engineForce / 100))} Nm Torque`);
    if (deltas.brakeForce > 0) parts.push(`+${Math.max(1, Math.round(deltas.brakeForce / 100))} kN Brakes`);
    if (deltas.turnRate > 0) parts.push(`+${deltas.turnRate.toFixed(2)} G Handling`);
    if (deltas.gripScore > 0) parts.push(`+${deltas.gripScore} Grip/Susp`);
    if (deltas.piRating > 0) parts.push(`+${deltas.piRating} PI`);
    return parts.length > 0 ? parts.join(' • ') : '+Performance Boost';
  }

  renderGarageUI() {
    this.refreshCreditsDisplay();
    const car = getCarById(this.garagePreviewCarId);
    this.garagePreviewCarId = car.id;
    const unlocked = this.save.isCarUnlocked(car.id);
    const isSelected = getCarById(this.save.getSelectedCarId()).id === car.id;
    const upgrades = this.save.getCarUpgrades(car.id);
    const customization = this.save.getCarCustomization(car.id, car);
    const effective = computeEffectiveSpecs(car, upgrades, customization);

    // Update 3D preview car on garage turntable
    this.engine.previewGarageCar(car.id);

    // Render Manufacturer Filter Pills (ALL, BMW, Mercedes-Benz, Audi, Porsche, Lamborghini, Ferrari, etc.)
    const filterBar = document.getElementById('garage-manufacturer-filters');
    if (filterBar) {
      filterBar.innerHTML = '';
      getManufacturersList().forEach((brand) => {
        const pill = document.createElement('button');
        pill.className = `brand-filter-pill ${brand === this.selectedManufacturer ? 'active' : ''}`;
        const count = brand === 'ALL' ? CAR_CATALOG.length : CAR_CATALOG.filter((c) => c.manufacturer === brand).length;
        pill.textContent = brand === 'ALL' ? `ALL (${count})` : `${brand.toUpperCase()} (${count})`;
        pill.addEventListener('click', () => {
          this.selectedManufacturer = brand;
          const visibleCars = brand === 'ALL' ? CAR_CATALOG : CAR_CATALOG.filter((c) => c.manufacturer === brand);
          if (visibleCars.length > 0 && !visibleCars.some((c) => c.id === this.garagePreviewCarId)) {
            this.garagePreviewCarId = visibleCars[0].id;
          }
          this.renderGarageUI();
        });
        filterBar.appendChild(pill);
      });
    }

    // Render Filtered Real-World Car Tabs
    const tabsContainer = document.getElementById('garage-car-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      const filteredCars = this.selectedManufacturer === 'ALL'
        ? CAR_CATALOG
        : CAR_CATALOG.filter((c) => c.manufacturer === this.selectedManufacturer);

      filteredCars.forEach((c) => {
        const isOwned = this.save.isCarUnlocked(c.id);
        const cCust = this.save.getCarCustomization(c.id, c);
        const cEff = computeEffectiveSpecs(c, this.save.getCarUpgrades(c.id), cCust);
        const btn = document.createElement('button');
        btn.className = `car-tab-btn ${c.id === car.id ? 'active' : ''}`;
        btn.innerHTML = `
          <span class="car-tab-brand">${c.manufacturer.toUpperCase()}</span>
          <span class="car-tab-name">${c.name}</span>
          <span class="car-tab-status">${isOwned ? `OWNED • ${cEff.piClass} ${cEff.piRating}` : '$' + c.price.toLocaleString()}</span>
        `;
        btn.addEventListener('click', () => {
          this.garagePreviewCarId = c.id;
          this.renderGarageUI();
        });
        tabsContainer.appendChild(btn);
      });
    }

    // Info Header & Real-World Technical Specifications
    const brandEl = document.getElementById('garage-car-brand');
    if (brandEl) brandEl.textContent = (car.manufacturer || '').toUpperCase();
    document.getElementById('garage-car-title').textContent = car.name;
    document.getElementById('garage-car-category').textContent = car.category;
    document.getElementById('garage-car-desc').textContent = car.description;

    const engEl = document.getElementById('tech-engine-val');
    if (engEl) engEl.textContent = car.specs.engineDescription || 'Twin-Turbo Performance Engine';
    const gbEl = document.getElementById('tech-gearbox-val');
    if (gbEl) gbEl.textContent = `${car.specs.gearboxName || '7-Speed DCT'} • ${car.specs.drivetrain || 'RWD'}`;
    const hpEl = document.getElementById('tech-accel-hp-val');
    if (hpEl) hpEl.textContent = `${effective.zeroToHundredSec}s (0–100) • ${effective.horsepower} hp`;
    const wtEl = document.getElementById('tech-weight-val');
    if (wtEl) {
      const dim = car.dimensions || { length: 4.55, width: 1.95 };
      wtEl.textContent = `${car.specs.mass.toLocaleString()} kg • ${dim.length}m × ${dim.width}m`;
    }

    // Sync Visual Customization Selectors
    const wheelSel = document.getElementById('garage-wheel-select');
    if (wheelSel) wheelSel.value = customization.wheelStyle || 'twin_five';
    const spoilerSel = document.getElementById('garage-spoiler-select');
    if (spoilerSel) spoilerSel.value = customization.spoilerStyle || car.dimensions?.spoilerType || 'sport';
    const stanceSel = document.getElementById('garage-stance-select');
    if (stanceSel) stanceSel.value = customization.stance || 'stock';

    // Render base + upgraded specification bars
    this.updateGarageSpecBars(car, upgrades, null);

    // Paint swatches
    const swatchBox = document.getElementById('garage-paint-swatches');
    if (swatchBox) {
      swatchBox.innerHTML = '';
      const activeColor = this.save.getCarColor(car.id, car.defaultColor);
      PAINT_SWATCHES.forEach((hex) => {
        const sw = document.createElement('button');
        sw.className = `paint-swatch ${activeColor.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`;
        sw.style.backgroundColor = hex;
        sw.addEventListener('click', () => {
          this.save.setCarColor(car.id, hex);
          this.engine.previewGarageCar(car.id);
          this.renderGarageUI();
        });
        swatchBox.appendChild(sw);
      });
    }

    // Buy / Select Action Button
    const actionBtn = document.getElementById('btn-garage-action');
    if (actionBtn) {
      if (unlocked) {
        actionBtn.textContent = isSelected ? '✓ EQUIPPED FOR RACE' : 'SELECT VEHICLE';
        actionBtn.disabled = isSelected;
        actionBtn.className = isSelected ? 'btn-primary equipped' : 'btn-primary';
      } else {
        const canAfford = this.save.getCredits() >= car.price;
        actionBtn.textContent = `PURCHASE CAR — $${car.price.toLocaleString()}`;
        actionBtn.disabled = !canAfford;
        actionBtn.className = canAfford ? 'btn-accent' : 'btn-disabled';
      }
    }

    // Render All 6 Multi-Level Performance Upgrade Categories
    const upgContainer = document.getElementById('garage-upgrades-list');
    if (upgContainer) {
      upgContainer.innerHTML = '';
      Object.entries(UPGRADE_CONFIG).forEach(([key, cfg]) => {
        const lvl = upgrades[key] || 0;
        const cost = getUpgradeCost(key, lvl);
        const canUpgrade = unlocked && cost !== null && this.save.getCredits() >= cost;

        const row = document.createElement('div');
        row.className = 'upgrade-row';
        row.dataset.upgradeKey = key;
        row.innerHTML = `
          <div class="upgrade-info">
            <div class="upgrade-title-line">
              <span class="upgrade-name">${cfg.icon || '🔧'} ${cfg.name}</span>
              <span class="upgrade-level">STAGE ${lvl} / ${cfg.maxLevel}</span>
            </div>
            <p class="upgrade-desc">${cfg.description}</p>
            <div class="upgrade-pips">
              ${Array.from({ length: cfg.maxLevel }, (_, i) => `<span class="pip ${i < lvl ? 'filled' : ''}"></span>`).join('')}
            </div>
          </div>
          <button class="btn-upgrade ${canUpgrade ? '' : 'disabled'}" ${!canUpgrade ? 'disabled' : ''}>
            ${!unlocked ? 'LOCKED' : cost === null ? 'MAXED' : 'UPGRADE $' + cost.toLocaleString()}
          </button>
        `;

        // Live Upgrade Preview on hover / focus
        row.addEventListener('mouseenter', () => {
          if (unlocked && cost !== null) {
            this.updateGarageSpecBars(car, upgrades, key);
          }
        });
        row.addEventListener('mouseleave', () => {
          this.updateGarageSpecBars(car, upgrades, null);
        });

        row.querySelector('.btn-upgrade')?.addEventListener('click', () => {
          if (!canUpgrade) return;
          const preview = previewUpgradeSpecs(car, upgrades, key);
          this.openPurchaseConfirmation({
            title: 'CONFIRM UPGRADE INSTALLATION',
            itemLabel: `${car.name} — ${cfg.name} (Stage ${lvl + 1} / ${cfg.maxLevel})`,
            gainSummary: this._formatUpgradeGainSummary(preview.deltas),
            cost,
            onConfirm: () => {
              if (this.save.upgradeCarStat(car.id, key, cost, cfg.maxLevel)) {
                this.engine.audioManager.playCheckpointChime();
                if (this.save.getSelectedCarId() === car.id) {
                  this.engine.spawnActivePlayerCar();
                }
                this.showGarageToast(`${cfg.name} Stage ${lvl + 1} installed`, 'green');
                this.renderGarageUI();
              }
            }
          });
        });

        upgContainer.appendChild(row);
      });
    }
  }

  _initSettings() {
    const s = this.save.getSettings();

    const bindSelect = (id, key, onChange) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = s[key];
      el.addEventListener('change', () => {
        this.save.updateSetting(key, el.value);
        if (onChange) onChange(el.value);
      });
    };

    bindSelect('setting-time', 'timeOfDay', (val) => {
      this.engine.environmentManager.applyEnvironment(val, this.save.getSettings().weather);
      this.engine.updateHeadlightState();
    });

    bindSelect('setting-weather', 'weather', (val) => {
      this.engine.environmentManager.applyEnvironment(this.save.getSettings().timeOfDay, val);
      this.engine.updateHeadlightState();
    });

    bindSelect('setting-traffic', 'trafficDensity', () => {});
    bindSelect('setting-ai-difficulty', 'aiDifficulty', (val) => {
      document.querySelectorAll('.diff-pill-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.diff === val);
      });
    });

    const bindSlider = (id, key, onChange) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = s[key] ?? 0.75;
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        this.save.updateSetting(key, v);
        if (onChange) onChange(v);
      });
    };

    bindSlider('setting-volume', 'soundVolume', (v) => this.engine.audioManager.setVolume(v));
    bindSlider('setting-engine-volume', 'engineVolume', (v) => this.engine.audioManager.setEngineVolume(v));
    bindSlider('setting-sfx-volume', 'sfxVolume', (v) => this.engine.audioManager.setSfxVolume(v));
    bindSlider('setting-ambient-volume', 'ambientVolume', (v) => this.engine.audioManager.setAmbientVolume(v));

    const muteCheck = document.getElementById('setting-audio-mute');
    if (muteCheck) {
      muteCheck.checked = Boolean(s.audioMuted);
      muteCheck.addEventListener('change', () => {
        const muted = muteCheck.checked;
        this.save.updateSetting('audioMuted', muted);
        this.engine.audioManager.setMuted(muted);
        this._syncHudMuteButton(muted);
      });
    }

    const touchToggle = document.getElementById('setting-touch-ui');
    if (touchToggle) {
      touchToggle.addEventListener('change', () => {
        const pad = document.getElementById('mobile-touch-controls');
        if (pad) {
          pad.classList.toggle('force-show', touchToggle.value === 'on');
          pad.classList.toggle('force-hide', touchToggle.value === 'off');
        }
      });
    }

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      this.screens.settings.classList.add('hidden');
    });

    // Reset Save Data with Confirmation Modal Workflow
    document.getElementById('btn-settings-reset-save')?.addEventListener('click', () => {
      this.screens.resetConfirmModal?.classList.remove('hidden');
    });

    document.getElementById('btn-confirm-reset-no')?.addEventListener('click', () => {
      this.screens.resetConfirmModal?.classList.add('hidden');
    });

    document.getElementById('btn-confirm-reset-yes')?.addEventListener('click', async () => {
      this.screens.resetConfirmModal?.classList.add('hidden');
      this.screens.settings?.classList.add('hidden');
      await this.save.resetSave();

      const freshSettings = this.save.getSettings();
      this.selectedManufacturer = 'ALL';
      this.garagePreviewCarId = this.save.getSelectedCarId();

      this._syncSettingsControls();
      this.engine.environmentManager.applyEnvironment(freshSettings.timeOfDay, freshSettings.weather);
      this.engine.audioManager.applyAudioSettings(freshSettings);
      this.engine.spawnActivePlayerCar();

      this.refreshMainMenu();
      this.renderGarageUI();
      this.renderMissionsUI();
      this.showGarageToast('Save data reset to defaults', 'green');
      this.engine.hudController?.showBanner('Save data reset to defaults', 'green');
    });
  }

  _syncSettingsControls() {
    const s = this.save.getSettings();
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    setVal('setting-time', s.timeOfDay);
    setVal('setting-weather', s.weather);
    setVal('setting-traffic', s.trafficDensity);
    setVal('setting-ai-difficulty', s.aiDifficulty);
    setVal('setting-volume', s.soundVolume ?? 0.75);
    setVal('setting-engine-volume', s.engineVolume ?? 0.85);
    setVal('setting-sfx-volume', s.sfxVolume ?? 0.85);
    setVal('setting-ambient-volume', s.ambientVolume ?? 0.70);

    const muteCheck = document.getElementById('setting-audio-mute');
    if (muteCheck) muteCheck.checked = Boolean(s.audioMuted);
    this._syncHudMuteButton(Boolean(s.audioMuted));

    document.querySelectorAll('.diff-pill-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.diff === s.aiDifficulty);
    });

    const statusBadge = document.getElementById('save-storage-status');
    if (statusBadge) {
      statusBadge.textContent = this.save.idbAvailable
        ? 'IndexedDB + LocalStorage Synced'
        : 'LocalStorage + Backup Active';
    }
  }

  openSettingsModal() {
    this._syncSettingsControls();
    this.screens.settings.classList.remove('hidden');
  }

  _initPauseAndResults() {
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.engine.togglePause();
    });

    document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
      this.screens.pause.classList.add('hidden');
      this.engine.restartCurrentRace();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('btn-pause-garage')?.addEventListener('click', () => {
      this.screens.pause.classList.add('hidden');
      this.engine.enterGarage();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
      this.screens.pause.classList.add('hidden');
      this.engine.returnToMainMenu();
    });

    document.getElementById('btn-pause-leave-mp')?.addEventListener('click', () => {
      this.screens.pause.classList.add('hidden');
      this.engine.leaveMultiplayerToLobby();
    });

    document.getElementById('btn-results-replay')?.addEventListener('click', () => {
      this.screens.results.classList.add('hidden');
      this.engine.restartCurrentRace();
    });

    document.getElementById('btn-results-garage')?.addEventListener('click', () => {
      this.screens.results.classList.add('hidden');
      this.engine.enterGarage();
    });

    document.getElementById('btn-results-menu')?.addEventListener('click', () => {
      this.screens.results.classList.add('hidden');
      this.engine.returnToMainMenu();
    });

    document.getElementById('btn-results-mp-lobby')?.addEventListener('click', () => {
      this.screens.results.classList.add('hidden');
      this.engine.multiplayerManager?.returnToRoomLobby();
      this.engine.enterMultiplayerLobby();
    });

    document.getElementById('btn-results-mp-leave')?.addEventListener('click', () => {
      this.screens.results.classList.add('hidden');
      this.engine.leaveMultiplayerToLobby();
    });
  }

  _initHUDButtons() {
    document.getElementById('btn-hud-leave-mp')?.addEventListener('click', () => {
      this.engine.leaveMultiplayerToLobby();
    });

    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      this.engine.togglePause();
    });

    document.getElementById('btn-hud-camera')?.addEventListener('click', () => {
      this.engine.cycleCamera();
    });

    document.getElementById('btn-hud-daynight')?.addEventListener('click', () => {
      const order = ['sunrise', 'day', 'sunset', 'night'];
      const curr = this.save.getSettings().timeOfDay;
      const next = order[(order.indexOf(curr) + 1) % order.length];
      this.save.updateSetting('timeOfDay', next);
      const sel = document.getElementById('setting-time');
      if (sel) sel.value = next;
      this.engine.environmentManager.applyEnvironment(next, this.save.getSettings().weather);
      this.engine.updateHeadlightState();
      this.engine.hudController.showBanner(`Time: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'cyan');
    });

    document.getElementById('btn-hud-weather')?.addEventListener('click', () => {
      this.engine.audioManager.init();
      this.engine.audioManager.playUIClick();
      const order = ['clear', 'rain', 'fog'];
      const labels = { clear: 'Clear Sky', rain: 'Rainstorm', fog: 'Dense Fog' };
      const curr = this.save.getSettings().weather;
      const next = order[(order.indexOf(curr) + 1) % order.length];
      this.save.updateSetting('weather', next);
      const sel = document.getElementById('setting-weather');
      if (sel) sel.value = next;
      this.engine.environmentManager.applyEnvironment(this.save.getSettings().timeOfDay, next);
      this.engine.updateHeadlightState();
      this.engine.hudController.showBanner(`Weather: ${labels[next]}`, 'cyan');
    });

    const muteBtn = document.getElementById('btn-hud-mute');
    if (muteBtn) {
      this._syncHudMuteButton(Boolean(this.save.getSettings().audioMuted));
      muteBtn.addEventListener('click', () => {
        this.engine.audioManager.init();
        const isMuted = this.engine.audioManager.toggleMute();
        this.save.updateSetting('audioMuted', isMuted);
        const muteCheck = document.getElementById('setting-audio-mute');
        if (muteCheck) muteCheck.checked = isMuted;
        this._syncHudMuteButton(isMuted);
        if (!isMuted) this.engine.audioManager.playUIClick();
        this.engine.hudController.showBanner(isMuted ? 'Audio Muted' : 'Audio Unmuted', 'white');
      });
    }

    // Play subtle UI click sound on buttons across menus
    document.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.audioManager.init();
        this.engine.audioManager.playUIClick();
      });
    });
  }

  _syncHudMuteButton(isMuted) {
    const muteBtn = document.getElementById('btn-hud-mute');
    if (muteBtn) {
      muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Audio';
    }
  }

  showResultsModal(summary) {
    document.getElementById('res-sp-actions')?.classList.remove('hidden');
    document.getElementById('res-mp-actions')?.classList.add('hidden');

    document.getElementById('res-headline').textContent = summary.headline;
    document.getElementById('res-mode').textContent = summary.mode;
    document.getElementById('res-rank').textContent = summary.rankLabel;
    document.getElementById('res-time').textContent = this.engine.hudController.formatTime(summary.elapsedTime);
    document.getElementById('res-reward').textContent = `+$${summary.rewardCredits.toLocaleString()}`;

    const recBadge = document.getElementById('res-record-badge');
    if (recBadge) {
      recBadge.classList.toggle('hidden', !summary.isNewRecord);
    }

    const standingsWrap = document.getElementById('res-standings-container');
    const standingsList = document.getElementById('res-standings-list');
    if (standingsWrap && standingsList) {
      if (summary.standings && summary.standings.length > 0) {
        standingsWrap.classList.remove('hidden');
        standingsList.innerHTML = summary.standings.map((row) => `
          <div class="standing-row ${row.isPlayer ? 'player-row' : ''}">
            <span class="st-pos">#${row.position}</span>
            <span class="st-name">${row.driverName}</span>
            <span class="st-time">${this.engine.hudController.formatTime(row.finishTime)}</span>
          </div>
        `).join('');
      } else {
        standingsWrap.classList.add('hidden');
      }
    }

    this.refreshCreditsDisplay();
    this.screens.results.classList.remove('hidden');
  }

  showMultiplayerResultsModal({ results = [], winnerId = null, byForfeit = false, localPlayerId = null, roomCode = '' }) {
    document.getElementById('res-sp-actions')?.classList.add('hidden');
    document.getElementById('res-mp-actions')?.classList.remove('hidden');
    document.getElementById('res-record-badge')?.classList.add('hidden');

    const winnerRow = results.find((r) => r.id === winnerId) || results[0] || null;
    const myRow = results.find((r) => r.id === localPlayerId) || null;
    const didWin = Boolean(winnerRow && winnerRow.id === localPlayerId);

    const rewardCredits = didWin ? 15000 : 7500;
    this.save.addCredits(rewardCredits);

    const headline = didWin
      ? (byForfeit ? '🏆 VICTORY — OPPONENT LEFT!' : '🏆 VICTORY — YOU WON!')
      : `🏁 WINNER: ${winnerRow ? winnerRow.name.toUpperCase() : 'OPPONENT'}`;

    document.getElementById('res-headline').textContent = headline;
    document.getElementById('res-mode').textContent = `Online 1v1 Multiplayer • Room ${roomCode}`;
    document.getElementById('res-rank').textContent = winnerRow
      ? `Winner: ${winnerRow.name} ${didWin ? '🥇' : '🥈'}`
      : 'Race Complete';
    document.getElementById('res-time').textContent = myRow && myRow.time !== null
      ? this.engine.hudController.formatTime(myRow.time)
      : (didWin && byForfeit ? 'Won by Forfeit' : 'DNF');
    document.getElementById('res-reward').textContent = `+$${rewardCredits.toLocaleString()}`;

    const standingsWrap = document.getElementById('res-standings-container');
    const standingsList = document.getElementById('res-standings-list');
    if (standingsWrap && standingsList) {
      standingsWrap.classList.remove('hidden');
      standingsList.innerHTML = results.map((row) => {
        const isMe = row.id === localPlayerId;
        const carDef = getCarById(row.carId);
        const timeStr = row.forfeit
          ? 'LEFT ROOM'
          : (row.dnf || row.time === null ? 'DNF' : this.engine.hudController.formatTime(row.time));
        return `
          <div class="standing-row ${isMe ? 'player-row' : ''}">
            <span class="st-pos">#${row.place}</span>
            <span class="st-name">${row.name}${isMe ? ' (You)' : ''} • ${carDef.name}</span>
            <span class="st-time">${timeStr}</span>
          </div>
        `;
      }).join('');
    }

    this.refreshCreditsDisplay();
    this.screens.results.classList.remove('hidden');
  }
}
