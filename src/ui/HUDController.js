const NOTIFICATION_DURATION_MS = 2000;
const TRANSITION_GAP_MS = 180;
const MAX_QUEUE_SIZE = 3;

export class HUDController {
  constructor() {
    this.elSpeed = document.getElementById('hud-speed-val');
    this.elGear = document.getElementById('hud-gear-val');
    this.elShiftLight = document.getElementById('hud-shift-light');
    this.elRpmText = document.getElementById('hud-rpm-val');
    this.elRpmFill = document.getElementById('hud-rpm-fill');
    this.elNitroFill = document.getElementById('hud-nitro-fill');
    this.elSpeedArc = document.getElementById('hud-speed-arc');
    this.elSpeedNeedle = document.getElementById('hud-speed-needle');

    this.elDistrict = document.getElementById('hud-district-name');
    this.elModeName = document.getElementById('hud-mode-title');
    this.elTimer = document.getElementById('hud-timer-val');
    this.elTimerLabel = document.getElementById('hud-timer-label');
    this.elLapBox = document.getElementById('hud-lap-box');
    this.elLapVal = document.getElementById('hud-lap-val');
    this.elPosBox = document.getElementById('hud-pos-box');
    this.elPosVal = document.getElementById('hud-pos-val');

    // Dedicated Checkpoint Indicator & Directional Compass
    this.elCheckpointBox = document.getElementById('hud-checkpoint-box');
    this.elCheckpointVal = document.getElementById('hud-checkpoint-val');
    this.elCheckpointDist = document.getElementById('hud-checkpoint-dist');
    this.elCheckpointArrow = document.getElementById('hud-checkpoint-arrow');

    this.elDistance = document.getElementById('hud-dist-val');
    this.elScore = document.getElementById('hud-score-val');
    this.elCredits = document.getElementById('hud-credits-val');
    this.elCamName = document.getElementById('hud-cam-name');
    this.elDriftBadge = document.getElementById('hud-drift-badge');
    this.elDriftPts = document.getElementById('hud-drift-pts');

    this.elBanner = document.getElementById('hud-event-banner');
    this.elMissionCard = document.getElementById('hud-mission-tracker');
    this.elMissionType = document.getElementById('hud-msn-type');
    this.elMissionPct = document.getElementById('hud-msn-pct');
    this.elMissionObj = document.getElementById('hud-msn-objective');
    this.elMissionSub = document.getElementById('hud-msn-progress-text');
    this.elMissionFill = document.getElementById('hud-msn-progress-fill');

    // Online Multiplayer Live Standings HUD Panel
    this.elMpCard = document.getElementById('hud-mp-tracker');
    this.elMpRoomBadge = document.getElementById('hud-mp-room-code');
    this.elMpPing = document.getElementById('hud-mp-ping');
    this.elMpP1Name = document.getElementById('hud-mp-p1-name');
    this.elMpP1Meta = document.getElementById('hud-mp-p1-meta');
    this.elMpP2Name = document.getElementById('hud-mp-p2-name');
    this.elMpP2Meta = document.getElementById('hud-mp-p2-meta');

    // Non-blocking HUD notification queue state (max 1 visible pill, 2s display, merge/queue support)
    this.bannerTimeout = null;
    this.transitionTimeout = null;
    this.activeNotification = null;
    this.notificationQueue = [];
  }

  formatTime(seconds) {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const tenths = Math.floor((s * 10) % 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  formatOrdinal(rank) {
    const suffixes = ['st', 'nd', 'rd'];
    const v = rank % 100;
    const suf = suffixes[(v - 20) % 10 - 1] || suffixes[v - 1] || 'th';
    return `${rank}${suf}`;
  }

  _classifyNotification(text, toneHint = null) {
    const str = String(text || '').trim();
    const upper = str.toUpperCase();

    let category = 'general';
    let replaceLive = false;

    if (/^[123]$|^GO!?$/.test(upper)) {
      category = 'countdown';
      replaceLive = true;
    } else if (upper.startsWith('CAMERA:') || upper.startsWith('WEATHER:') || upper.startsWith('TIME:') || upper.startsWith('TIME OF DAY:') || upper.startsWith('AUDIO')) {
      category = upper.split(':')[0].trim().toLowerCase();
      replaceLive = true;
    } else if (upper.includes('NEAR MISS')) {
      category = 'near_miss';
    } else if (upper.includes('CHECKPOINT') || upper.includes('GATE')) {
      category = 'checkpoint';
    } else if (upper.includes('ROUTE') || upper.includes('CARGO') || upper.includes('MISSION')) {
      category = 'mission';
    } else if (upper.includes('LAP')) {
      category = 'lap';
    } else if (upper.includes('RESET')) {
      category = 'system';
      replaceLive = true;
    }

    let tone = 'white';
    if (toneHint === 'green' || toneHint === 'cyan' || toneHint === 'white') {
      tone = toneHint;
    } else if (
      toneHint === '#22c55e' ||
      toneHint === '#4ade80' ||
      upper.includes('+$') ||
      upper.includes('GO!') ||
      upper.includes('DELIVERED')
    ) {
      tone = 'green';
    } else if (
      toneHint === '#38bdf8' ||
      toneHint === '#22d3ee' ||
      category === 'checkpoint' ||
      category === 'mission' ||
      category === 'camera' ||
      category === 'weather'
    ) {
      tone = 'cyan';
    } else {
      tone = 'white';
    }

    // Parse optional "+$200" or "+250 pts" for merging repeated reward notices
    const cashMatch = str.match(/\+\$(\d[\d,]*)/);
    const cashDelta = cashMatch ? parseInt(cashMatch[1].replace(/,/g, ''), 10) : 0;

    return { text: str, tone, category, replaceLive, cashDelta, mergeCount: 1 };
  }

  _mergeItems(existing, incoming) {
    if (incoming.category === 'near_miss' && existing.category === 'near_miss') {
      const totalCount = (existing.mergeCount || 1) + 1;
      const totalCash = (existing.cashDelta || 0) + (incoming.cashDelta || 0);
      const rewardStr = totalCash > 0 ? ` • +$${totalCash.toLocaleString()}` : '';
      return {
        ...incoming,
        text: `Near Miss ×${totalCount}${rewardStr}`,
        mergeCount: totalCount,
        cashDelta: totalCash,
        tone: 'green'
      };
    }
    // For checkpoint/mission/lap updates, keep the freshest concise message
    return {
      ...incoming,
      mergeCount: (existing.mergeCount || 1) + 1
    };
  }

  _renderNotification(item) {
    if (!this.elBanner || !item) return;

    this.activeNotification = item;
    this.elBanner.textContent = item.text;
    this.elBanner.classList.remove('tone-white', 'tone-cyan', 'tone-green');
    this.elBanner.classList.add(`tone-${item.tone}`);
    this.elBanner.classList.add('visible');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this._hideAndAdvanceQueue();
    }, NOTIFICATION_DURATION_MS);
  }

  _hideAndAdvanceQueue() {
    if (!this.elBanner) return;
    this.elBanner.classList.remove('visible');
    this.activeNotification = null;

    if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
    if (this.notificationQueue.length > 0) {
      this.transitionTimeout = setTimeout(() => {
        const nextItem = this.notificationQueue.shift();
        if (nextItem) {
          this._renderNotification(nextItem);
        }
      }, TRANSITION_GAP_MS);
    }
  }

  clearNotifications() {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
    this.bannerTimeout = null;
    this.transitionTimeout = null;
    this.activeNotification = null;
    this.notificationQueue = [];
    if (this.elBanner) {
      this.elBanner.classList.remove('visible');
    }
  }

  /**
   * Displays a subtle, non-blocking HUD notification for 2 seconds.
   * Automatically merges repeated updates of the same type or queues distinct events (never stacks).
   */
  showBanner(text, toneOrColor = 'cyan', options = null) {
    if (!this.elBanner || !text) return;

    const item = this._classifyNotification(text, options?.tone || toneOrColor);

    if (item.replaceLive) {
      this.notificationQueue = this.notificationQueue.filter((q) => q.category !== item.category);
      if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
      this._renderNotification(item);
      return;
    }

    if (!this.activeNotification) {
      if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
      this._renderNotification(item);
      return;
    }

    // Merge if identical category is currently showing and no other queued events sit ahead
    if (this.activeNotification.category === item.category && this.notificationQueue.length === 0) {
      this._renderNotification(this._mergeItems(this.activeNotification, item));
      return;
    }

    // Merge with matching queued item of same category to prevent duplicate buildup
    const qIdx = this.notificationQueue.findIndex((q) => q.category === item.category);
    if (qIdx !== -1) {
      this.notificationQueue[qIdx] = this._mergeItems(this.notificationQueue[qIdx], item);
      return;
    }

    if (this.notificationQueue.length < MAX_QUEUE_SIZE) {
      this.notificationQueue.push(item);
    } else {
      // Keep queue bounded so race telemetry remains responsive
      this.notificationQueue[this.notificationQueue.length - 1] = item;
    }
  }

  update(vehicle, raceManager, saveManager, cameraController, multiplayerManager = null) {
    if (!vehicle) return;

    // 1. Speedometer (Digital + Radial Arc + Rotating Needle)
    const speedKmh = vehicle.getSpeedKmh();
    if (this.elSpeed) this.elSpeed.textContent = String(speedKmh).padStart(3, '0');

    const maxArcSpeed = vehicle.specs?.topSpeedKmh || 320;
    const speedRatio = Math.min(1, speedKmh / maxArcSpeed);
    if (this.elSpeedArc) {
      const offset = 251.2 * (1 - speedRatio * 0.82);
      this.elSpeedArc.style.strokeDashoffset = String(offset);
    }
    if (this.elSpeedNeedle) {
      const angleDeg = speedRatio * 270;
      this.elSpeedNeedle.style.transform = `rotate(${angleDeg}deg)`;
    }

    // 2. Gear & Redline Shift Light
    if (this.elGear) {
      const gearLabel = vehicle.getGearLabel();
      this.elGear.textContent = gearLabel;
      this.elGear.className = 'gear-badge' + (gearLabel === 'R' ? ' reverse' : '');
    }

    // 3. RPM Readout & Bar
    const rpm = Math.round(vehicle.rpm);
    const redline = vehicle.specs?.redlineRpm || 8000;
    const rpmPct = Math.min(100, Math.round((rpm / redline) * 100));

    if (this.elRpmText) this.elRpmText.textContent = `${rpm.toLocaleString()} RPM`;
    if (this.elRpmFill) {
      this.elRpmFill.style.width = `${rpmPct}%`;
      this.elRpmFill.style.background = rpmPct > 86
        ? 'linear-gradient(90deg, #f97316, #ef4444)'
        : 'linear-gradient(90deg, #0ea5e9, #22d3ee)';
    }
    if (this.elShiftLight) {
      this.elShiftLight.classList.toggle('active', rpmPct >= 87 && vehicle.gear >= 1 && vehicle.gear < 6);
    }

    // 4. Nitro Boost Gauge
    if (this.elNitroFill) {
      this.elNitroFill.style.width = `${Math.round(vehicle.nitroAmount)}%`;
    }

    // 5. Drift Live Counter Badge
    if (this.elDriftBadge && this.elDriftPts) {
      if (vehicle.isDrifting && vehicle.currentDriftPoints > 15) {
        this.elDriftBadge.classList.add('active');
        this.elDriftPts.textContent = `+${Math.round(vehicle.currentDriftPoints)} DRIFT`;
      } else {
        this.elDriftBadge.classList.remove('active');
      }
    }

    // 6. USA District Name, Distance & Currency
    if (this.elDistrict && vehicle.currentDistrict) {
      this.elDistrict.textContent = vehicle.currentDistrict.toUpperCase();
    }
    if (this.elDistance) {
      this.elDistance.textContent = `${(vehicle.distanceDriven / 1000).toFixed(2)} km`;
    }
    if (this.elCredits && saveManager) {
      this.elCredits.textContent = `$${saveManager.getCredits().toLocaleString()}`;
    }
    if (this.elCamName && cameraController) {
      this.elCamName.textContent = cameraController.getModeName();
    }

    // 7. Race Timer, Lap Count, Position, Checkpoint Compass & Mission Progress
    if (raceManager) {
      const mode = raceManager.currentMode;
      const activeMsn = raceManager.activeMission;
      const usesCountdownClock =
        mode === 'checkpoint' ||
        mode === 'traffic' ||
        (activeMsn && activeMsn.type !== 'racing_mission');

      if (usesCountdownClock) {
        if (this.elTimerLabel) this.elTimerLabel.textContent = 'TIME LEFT';
        if (this.elTimer) {
          this.elTimer.textContent = this.formatTime(raceManager.remainingTime);
          this.elTimer.classList.toggle('low-time', raceManager.remainingTime < 10.0);
        }
      } else {
        if (this.elTimerLabel) this.elTimerLabel.textContent = 'TIME';
        if (this.elTimer) {
          this.elTimer.textContent = this.formatTime(raceManager.elapsedTime);
          this.elTimer.classList.remove('low-time');
        }
      }

      // Lap Counter
      if (mode === 'circuit' || mode === 'city_race' || mode === 'timetrial') {
        if (this.elLapBox) this.elLapBox.style.display = 'flex';
        if (this.elLapVal) this.elLapVal.textContent = `${raceManager.currentLap} / ${raceManager.totalLaps}`;
      } else {
        if (this.elLapBox) this.elLapBox.style.display = 'none';
      }

      // Race Position Counter
      if (mode === 'circuit' || mode === 'city_race') {
        if (this.elPosBox) this.elPosBox.style.display = 'flex';
        if (this.elPosVal) {
          this.elPosVal.textContent = `${this.formatOrdinal(raceManager.playerPosition)} / ${raceManager.totalRacers}`;
        }
      } else {
        if (this.elPosBox) this.elPosBox.style.display = 'none';
      }

      // Dedicated Checkpoint Indicator & Rotating Directional Arrow
      const nextCpPos = raceManager.getNextCheckpointWorldPos();
      if (this.elCheckpointBox) {
        if (nextCpPos) {
          this.elCheckpointBox.style.display = 'flex';
          const distMeters = Math.round(vehicle.position.distanceTo(nextCpPos));
          if (this.elCheckpointDist) this.elCheckpointDist.textContent = `${distMeters}m`;

          if (activeMsn && activeMsn.type === 'delivery_mission') {
            const totalWp = raceManager.deliveryWaypoints.length || 5;
            if (this.elCheckpointVal) {
              this.elCheckpointVal.textContent = `${Math.min(totalWp, raceManager.deliveryWaypointIdx + 1)}/${totalWp}`;
            }
          } else if (mode === 'checkpoint') {
            if (this.elCheckpointVal) {
              this.elCheckpointVal.textContent = `${raceManager.checkpointsCleared}/${raceManager.totalCheckpointsToClear}`;
            }
          } else {
            const numCp = raceManager.checkpoints.length || 10;
            if (this.elCheckpointVal) {
              this.elCheckpointVal.textContent = `${raceManager.checkpointsClearedInLap + 1}/${numCp}`;
            }
          }

          // Compute relative bearing angle to next checkpoint gate for compass arrow
          if (this.elCheckpointArrow) {
            const dx = nextCpPos.x - vehicle.position.x;
            const dz = nextCpPos.z - vehicle.position.z;
            const worldBearing = Math.atan2(dx, dz);
            // In right-handed 3D (+X left of +Z), positive angle is counter-clockwise, so screen clockwise = -(worldBearing - heading)
            let relAngle = -(worldBearing - vehicle.heading);
            const deg = Math.round((relAngle * 180) / Math.PI);
            this.elCheckpointArrow.style.transform = `rotate(${deg}deg)`;
          }
        } else {
          this.elCheckpointBox.style.display = 'none';
        }
      }

      // Live Mission Objective Tracker Panel
      if (this.elMissionCard) {
        if (activeMsn) {
          this.elMissionCard.classList.remove('hidden');
          if (this.elMissionType) this.elMissionType.textContent = `${activeMsn.icon} ${activeMsn.typeLabel.toUpperCase()}`;
          if (this.elMissionPct) this.elMissionPct.textContent = `${raceManager.missionProgressPct}%`;
          if (this.elMissionObj) this.elMissionObj.textContent = activeMsn.objective;
          if (this.elMissionSub) this.elMissionSub.textContent = raceManager.missionProgressText;
          if (this.elMissionFill) this.elMissionFill.style.width = `${raceManager.missionProgressPct}%`;
        } else {
          this.elMissionCard.classList.add('hidden');
        }
      }

      if (this.elScore) {
        this.elScore.textContent = Math.round(raceManager.score).toLocaleString();
      }
    }

    // 8. Online Multiplayer Live Leaderboard & Opponent Telemetry HUD
    if (this.elMpCard) {
      if (multiplayerManager && multiplayerManager.isInRoom() && raceManager?.isMultiplayer) {
        this.elMpCard.classList.remove('hidden');
        if (this.elMpRoomBadge) {
          this.elMpRoomBadge.textContent = `ROOM ${multiplayerManager.roomCode}`;
        }
        if (this.elMpPing) {
          const rtt = multiplayerManager.pingMs ? `${multiplayerManager.pingMs}ms` : 'LIVE';
          this.elMpPing.textContent = multiplayerManager.connectionState === 'reconnecting' ? 'RECONNECTING' : `● ${rtt}`;
        }

        const meName = multiplayerManager.getSavedPlayerName() || 'You';
        const opp = multiplayerManager.opponent;
        const myPos = raceManager.playerPosition || 1;
        const oppPos = myPos === 1 ? 2 : 1;

        const p1Entry = myPos === 1
          ? { name: `${meName} (You)`, meta: `Lap ${raceManager.currentLap}/${raceManager.totalLaps} • ${speedKmh} km/h` }
          : {
              name: opp ? opp.name : 'Opponent',
              meta: opp
                ? (opp.finished ? `Finished (${this.formatTime(opp.finishTime || 0)})` : `Lap ${opp.lap}/${raceManager.totalLaps} • ${Math.round(Math.abs(opp.speed) * 3.6)} km/h`)
                : 'Waiting...'
            };

        const p2Entry = myPos === 2
          ? { name: `${meName} (You)`, meta: `Lap ${raceManager.currentLap}/${raceManager.totalLaps} • ${speedKmh} km/h` }
          : {
              name: opp ? opp.name : 'Opponent',
              meta: opp
                ? (opp.finished ? `Finished (${this.formatTime(opp.finishTime || 0)})` : (opp.connected === false ? 'Reconnecting...' : `Lap ${opp.lap}/${raceManager.totalLaps} • ${Math.round(Math.abs(opp.speed) * 3.6)} km/h`))
                : 'Disconnected'
            };

        if (this.elMpP1Name) this.elMpP1Name.textContent = `1st • ${p1Entry.name}`;
        if (this.elMpP1Meta) this.elMpP1Meta.textContent = p1Entry.meta;
        if (this.elMpP2Name) this.elMpP2Name.textContent = `2nd • ${p2Entry.name}`;
        if (this.elMpP2Meta) this.elMpP2Meta.textContent = p2Entry.meta;
      } else {
        this.elMpCard.classList.add('hidden');
      }
    }
  }
}
