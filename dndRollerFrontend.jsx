import React, { useEffect, useRef, useState } from 'react';
import { getActionDiceGroups, MAX_ACTION_LEVEL, normalizeAction } from './actionUtils.js';

const STORAGE_KEY = 'dnd-roller-attacks';
const HIT_MODIFIER_STORAGE_KEY = 'dnd-roller-hit-modifier';
const EXPORT_FORMAT = 'dnd-roller-actions';
const LEGACY_EXPORT_FORMAT = 'dnd-roller-attacks';
const EXPORT_VERSION = 4;

function createEmptyActionForm() {
  return {
    name: '',
    numDice: '',
    diceSides: '',
    modifier: '',
    ownerType: '',
    ownerName: '',
    levelScaling: false,
    baseLevel: '1',
    scalingNumDice: '',
    scalingDiceSides: '',
  };
}

function createActionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function App() {
  const fileInputRef = useRef(null);
  const forgePanelRef = useRef(null);
  const rollResultRef = useRef(null);
  const [exportFilename, setExportFilename] = useState('my-dnd-actions');
  const [hitModifier, setHitModifier] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(HIT_MODIFIER_STORAGE_KEY) ?? 0);
      return Number.isInteger(saved) ? String(saved) : '0';
    } catch (error) {
      console.error('Could not read the hit modifier:', error);
      return '0';
    }
  });
  const [actions, setActions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((action, index) => normalizeAction(action, `${Date.now()}-${index}`));
    } catch (error) {
      console.error('Could not read saved actions:', error);
      return [];
    }
  });
  const [newAction, setNewAction] = useState(createEmptyActionForm);
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionLevels, setActionLevels] = useState({});
  const [actionFilter, setActionFilter] = useState('all');
  const [rollResult, setRollResult] = useState('');
  const [rollScrollVersion, setRollScrollVersion] = useState(0);
  const [isCriticalHit, setIsCriticalHit] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.location.hash === '#privacy') {
      document.getElementById('privacy-title')?.scrollIntoView({ block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (rollScrollVersion === 0) return;

    rollResultRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [rollScrollVersion]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    } catch (storageError) {
      console.error('Could not save actions:', storageError);
      setError('Could not save actions in this browser. Check available storage space or browser settings.');
    }
  }, [actions]);

  useEffect(() => {
    try {
      localStorage.setItem(HIT_MODIFIER_STORAGE_KEY, hitModifier);
    } catch (storageError) {
      console.error('Could not save the hit modifier:', storageError);
      setError('Could not save the hit modifier in this browser.');
    }
  }, [hitModifier]);

  function saveAction(event) {
    event.preventDefault();
    setError('');

    const name = newAction.name.trim();
    const numDice = Number(newAction.numDice);
    const diceSides = Number(newAction.diceSides);
    const modifier = Number(newAction.modifier || 0);
    const ownerName = newAction.ownerName.trim();
    const baseLevel = Number(newAction.baseLevel);
    const scalingNumDice = Number(newAction.scalingNumDice);
    const scalingDiceSides = Number(newAction.scalingDiceSides);

    if (
      !name ||
      !Number.isInteger(numDice) ||
      !Number.isInteger(diceSides) ||
      !Number.isInteger(modifier) ||
      numDice <= 0 ||
      diceSides <= 0 ||
      (newAction.ownerType && !ownerName) ||
      (newAction.levelScaling && (
        !Number.isInteger(baseLevel) ||
        baseLevel < 1 ||
        baseLevel > MAX_ACTION_LEVEL ||
        !Number.isInteger(scalingNumDice) ||
        scalingNumDice <= 0 ||
        !Number.isInteger(scalingDiceSides) ||
        scalingDiceSides <= 0
      ))
    ) {
      setError('Enter a name, valid dice values, and complete level-scaling values when enabled.');
      return;
    }

    const action = {
      id: editingActionId || createActionId(),
      name,
      num_dice: numDice,
      dice_sides: diceSides,
      modifier,
      owner_type: newAction.ownerType || null,
      owner_name: ownerName,
      level_scaling: newAction.levelScaling
        ? {
          base_level: baseLevel,
          num_dice: scalingNumDice,
          dice_sides: scalingDiceSides,
        }
        : null,
    };

    if (editingActionId) {
      setActions((currentActions) => currentActions.map((currentAction) =>
        currentAction.id === editingActionId ? action : currentAction
      ));
      setActionLevels((currentLevels) => {
        const nextLevels = { ...currentLevels };
        if (action.level_scaling) {
          nextLevels[action.id] = String(action.level_scaling.base_level);
        } else {
          delete nextLevels[action.id];
        }
        return nextLevels;
      });
    } else {
      setActions((currentActions) => [...currentActions, action]);
    }
    setEditingActionId(null);
    setNewAction(createEmptyActionForm());
    setError('');
  }

  function editAction(action) {
    setEditingActionId(action.id);
    setNewAction({
      name: action.name,
      numDice: String(action.num_dice),
      diceSides: String(action.dice_sides),
      modifier: String(action.modifier),
      ownerType: action.owner_type || '',
      ownerName: action.owner_name,
      levelScaling: Boolean(action.level_scaling),
      baseLevel: String(action.level_scaling?.base_level ?? 1),
      scalingNumDice: action.level_scaling ? String(action.level_scaling.num_dice) : '',
      scalingDiceSides: action.level_scaling ? String(action.level_scaling.dice_sides) : '',
    });
    setError('');
    forgePanelRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  function cancelEdit() {
    setEditingActionId(null);
    setNewAction(createEmptyActionForm());
    setError('');
  }

  function deleteAction(id) {
    setActions((currentActions) => currentActions.filter((action) => action.id !== id));
    if (editingActionId === id) cancelEdit();
  }

  function rollAction(action) {
    const level = action.level_scaling
      ? Number(actionLevels[action.id] ?? action.level_scaling.base_level)
      : null;
    let diceGroups;
    try {
      diceGroups = getActionDiceGroups(action, level);
    } catch (rollError) {
      setError(rollError.message);
      return;
    }

    const rollDetails = diceGroups.map(({ num_dice, dice_sides }) => {
      const rolls = Array.from({ length: num_dice }, () => Math.floor(Math.random() * dice_sides) + 1);
      return {
        description: `${num_dice}d${dice_sides} (${rolls.join(', ')})`,
        total: rolls.reduce((sum, value) => sum + value, 0),
      };
    });
    const notation = rollDetails.map((group) => group.description).join(' + ');
    const total = rollDetails.reduce((sum, group) => sum + group.total, 0) + action.modifier;

    setIsCriticalHit(false);
    setError('');
    setRollResult(`${action.name}${level === null ? '' : ` (Level ${level})`}: ${notation}\nTotal: ${total}`);
    setRollScrollVersion((version) => version + 1);
  }

  function rollToHit() {
    const modifier = Number(hitModifier || 0);
    if (!Number.isInteger(modifier)) {
      setError('The roll-to-hit modifier must be a whole number.');
      return;
    }

    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    const modifierText = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
    const critical = roll === 20;
    setIsCriticalHit(critical);
    setRollResult(`${critical ? 'NATURAL 20 — CRITICAL HIT!\n' : ''}To hit: d20 (${roll})${modifierText} = ${total}`);
    setError('');
    setRollScrollVersion((version) => version + 1);
  }

  function exportActions() {
    const modifier = Number(hitModifier || 0);
    if (!Number.isInteger(modifier)) {
      setError('The roll-to-hit modifier must be a whole number before exporting.');
      return;
    }

    const data = JSON.stringify({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      hitModifier: modifier,
      actions,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeFilename = exportFilename.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/[. ]+$/g, '') || 'my-dnd-actions';
    link.download = `${safeFilename}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importActions(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        let importedActions;
        let importedHitModifier = 0;

        if (Array.isArray(parsed)) {
          importedActions = parsed;
        } else if (
          parsed?.format === EXPORT_FORMAT &&
          [1, 2, 3, EXPORT_VERSION].includes(parsed?.version) &&
          Array.isArray(parsed?.actions)
        ) {
          importedActions = parsed.actions;
          if (parsed.hitModifier !== undefined) {
            importedHitModifier = Number(parsed.hitModifier);
            if (!Number.isInteger(importedHitModifier)) {
              throw new Error('The imported roll-to-hit modifier must be a whole number.');
            }
          }
        } else if (
          parsed?.version === 1 &&
          parsed?.format === LEGACY_EXPORT_FORMAT &&
          Array.isArray(parsed.attacks)
        ) {
          importedActions = parsed.attacks;
        } else {
          throw new Error('This file is not a supported D&D Roller export.');
        }

        const normalized = importedActions.map((action, index) =>
          normalizeAction(action, `${Date.now()}-${index}`)
        ).map((action) => ({ ...action, id: createActionId() }));
        if (!window.confirm(`Import ${normalized.length} action(s)? This will replace your current list.`)) {
          return;
        }
        setActions(normalized);
        setActionLevels({});
        cancelEdit();
        setHitModifier(String(importedHitModifier));
        setRollResult('');
        setIsCriticalHit(false);
        setError('');
      } catch (error) {
        console.error('Import failed:', error);
        setError(error.message || 'Could not import file.');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  }

  function resetActions() {
    if (!window.confirm('Delete all saved actions from this browser? This cannot be undone unless you exported a backup.')) {
      return;
    }

    setActions([]);
    setActionLevels({});
    cancelEdit();
    setRollResult('');
    setIsCriticalHit(false);
    setError('');
  }

  const visibleActions = actions
    .filter((action) => actionFilter === 'all' || (action.owner_type || 'unassigned') === actionFilter)
    .slice()
    .sort((first, second) => {
      const ownerOrder = (first.owner_type || 'unassigned').localeCompare(second.owner_type || 'unassigned');
      if (ownerOrder !== 0) return ownerOrder;

      const nameOrder = first.owner_name.localeCompare(second.owner_name, undefined, { sensitivity: 'base' });
      if (nameOrder !== 0) return nameOrder;

      return first.name.localeCompare(second.name, undefined, { sensitivity: 'base' });
    });

  const actionGroups = visibleActions.reduce((groups, action) => {
    const groupKey = action.owner_type
      ? `${action.owner_type}:${action.owner_name.toLocaleLowerCase()}`
      : 'unassigned';
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.key !== groupKey) {
      groups.push({
        key: groupKey,
        label: action.owner_name || 'Unassigned actions',
        type: action.owner_type,
        actions: [action],
      });
    } else {
      currentGroup.actions.push(action);
    }

    return groups;
  }, []);

  const filterCounts = {
    all: actions.length,
    character: actions.filter((action) => action.owner_type === 'character').length,
    enemy: actions.filter((action) => action.owner_type === 'enemy').length,
    unassigned: actions.filter((action) => !action.owner_type).length,
  };
  const ownerSuggestions = [...new Map(
    actions
      .filter((action) => action.owner_type === newAction.ownerType)
      .map((action) => [action.owner_name.toLocaleLowerCase(), action.owner_name])
  ).values()].sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="The Dice Vault home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>THE DICE VAULT</span>
        </a>
        <div className="topbar-actions">
          <span className="save-status"><span className="status-dot" /> Saved in this browser</span>
          <button className="button button-quiet" type="button" onClick={() => fileInputRef.current?.click()}>
            <span aria-hidden="true">↥</span> Import
          </button>
          <button className="button button-quiet" type="button" onClick={exportActions}>
            <span aria-hidden="true">↧</span> Export
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={importActions}
          className="visually-hidden"
          aria-label="Import actions file"
        />
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> YOUR ADVENTURE, AT A ROLL</p>
            <h1>D&amp;D Dice &amp; Action<br /><em>Roller</em></h1>
            <p className="hero-description">
                Keep your abilities close. Roll for damage, healing, and every daring thing in between.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="rune rune-one">ᚱ</div>
            <div className="rune rune-two">✧</div>
            <div className="die"><span>D</span><strong>20</strong><i>✦</i></div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
          </div>
        </section>

        <div className="workspace">
          <section className="panel forge-panel" ref={forgePanelRef}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR ADVENTURER'S KIT</p>
                <h2>{editingActionId ? 'Edit action' : 'Create an action'}</h2>
              </div>
              <span className="heading-icon" aria-hidden="true">⚒</span>
            </div>
            <form className="attack-form" onSubmit={saveAction}>
              <label className="field field-wide">
                <span>Action name</span>
                <input
                  type="text"
                  value={newAction.name}
                  onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                  placeholder="e.g. Healing Word, Strike, Fireball etc"
                  maxLength="80"
                  required
                />
              </label>
              <label className="field">
                <span>Number of dice</span>
                <input
                  type="number"
                  value={newAction.numDice}
                  onChange={(e) => setNewAction({ ...newAction, numDice: e.target.value })}
                  placeholder="2"
                  min="1"
                  step="1"
                  required
                />
              </label>
              <label className="field">
                <span>Die sides</span>
                <input
                  type="number"
                  value={newAction.diceSides}
                  onChange={(e) => setNewAction({ ...newAction, diceSides: e.target.value })}
                  placeholder="8"
                  min="1"
                  step="1"
                  required
                />
              </label>
              <label className="field">
                <span>Link to</span>
                <select
                  value={newAction.ownerType}
                  onChange={(event) => setNewAction({ ...newAction, ownerType: event.target.value, ownerName: '' })}
                >
                  <option value="">No character or enemy</option>
                  <option value="character">Character</option>
                  <option value="enemy">Enemy</option>
                </select>
              </label>
              {newAction.ownerType && (
                <label className="field">
                  <span>{newAction.ownerType === 'character' ? 'Character name' : 'Enemy name'}</span>
                  <input
                    type="text"
                    value={newAction.ownerName}
                    onChange={(event) => setNewAction({ ...newAction, ownerName: event.target.value })}
                    placeholder={newAction.ownerType === 'character' ? 'e.g. Aria' : 'e.g. Goblin chief'}
                    maxLength="80"
                    list={`owner-suggestions-${newAction.ownerType}`}
                    required
                  />
                  <datalist id={`owner-suggestions-${newAction.ownerType}`}>
                    {ownerSuggestions.map((ownerName) => <option key={ownerName} value={ownerName} />)}
                  </datalist>
                </label>
              )}
              <label className="field field-wide">
                <span>Modifier <small>OPTIONAL</small></span>
                <input
                  type="number"
                  value={newAction.modifier}
                  onChange={(e) => setNewAction({ ...newAction, modifier: e.target.value })}
                  placeholder="0"
                  step="1"
                />
              </label>
              <label className="level-scaling-toggle field-wide">
                <input
                  type="checkbox"
                  checked={newAction.levelScaling}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setNewAction((currentAction) => ({
                      ...currentAction,
                      levelScaling: checked,
                      scalingNumDice: checked
                        ? currentAction.scalingNumDice || currentAction.numDice
                        : currentAction.scalingNumDice,
                      scalingDiceSides: checked
                        ? currentAction.scalingDiceSides || currentAction.diceSides
                        : currentAction.scalingDiceSides,
                    }));
                  }}
                />
                <span>Scales when used at a higher level</span>
              </label>
              {newAction.levelScaling && (
                <div className="level-scaling-options field-wide">
                  <label className="field">
                    <span>Base level</span>
                    <input
                      type="number"
                      value={newAction.baseLevel}
                      onChange={(event) => setNewAction({ ...newAction, baseLevel: event.target.value })}
                      min="1"
                      max={MAX_ACTION_LEVEL}
                      step="1"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Extra dice per level</span>
                    <input
                      type="number"
                      value={newAction.scalingNumDice}
                      onChange={(event) => setNewAction({ ...newAction, scalingNumDice: event.target.value })}
                      min="1"
                      step="1"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Extra die sides</span>
                    <input
                      type="number"
                      value={newAction.scalingDiceSides}
                      onChange={(event) => setNewAction({ ...newAction, scalingDiceSides: event.target.value })}
                      min="1"
                      step="1"
                      required
                    />
                  </label>
                  <p className="level-scaling-note">
                    Each level above the base adds the extra dice shown.
                  </p>
                </div>
              )}
              {editingActionId && (
                <button className="button button-quiet field-wide" type="button" onClick={cancelEdit}>
                  Cancel editing
                </button>
              )}
              <button className="button button-primary field-wide" type="submit">
                <span aria-hidden="true">✦</span> {editingActionId ? 'Save changes' : 'Save action'}
              </button>
            </form>

            <div className="import-note">
              <span className="note-icon" aria-hidden="true">⌘</span>
              <span>Link actions to a character or enemy to keep each list organized.</span>
            </div>
          </section>

          <section className="panel arsenal-panel">
            <div className="panel-heading arsenal-heading">
              <div>
                <p className="eyebrow">READY FOR YOUR NEXT TURN</p>
                <div className="action-heading-row">
                  <h2>Your actions <span className="count-badge">{actions.length}</span></h2>
                  <div className="hit-controls">
                    <label className="hit-modifier">
                      <span>HIT MOD</span>
                      <input
                        type="number"
                        step="1"
                        value={hitModifier}
                        onChange={(event) => setHitModifier(event.target.value)}
                        aria-label="Roll to hit modifier"
                      />
                    </label>
                    <button className="button button-hit" type="button" onClick={rollToHit}>
                      Roll to hit <span aria-hidden="true">d20</span>
                    </button>
                  </div>
                </div>
              </div>
              {actions.length > 0 && (
                <button className="text-button" type="button" onClick={resetActions}>Clear all</button>
              )}
            </div>

            {rollResult && (
              <div
                ref={rollResultRef}
                className={`roll-result${isCriticalHit ? ' critical-hit' : ''}`}
                role="status"
                aria-live="polite"
              >
                <span className="result-spark" aria-hidden="true">{isCriticalHit ? '✹' : '✦'}</span>
                <div>
                  <p className="eyebrow">{isCriticalHit ? 'CRITICAL HIT' : 'THE FATES HAVE SPOKEN'}</p>
                  <pre>{rollResult}</pre>
                </div>
              </div>
            )}

            <div className="action-filters" role="group" aria-label="Filter actions">
              {[
                ['all', 'All'],
                ['character', 'Characters'],
                ['enemy', 'Enemies'],
                ['unassigned', 'Unassigned'],
              ].map(([filter, label]) => (
                <button
                  className={`filter-button${actionFilter === filter ? ' is-active' : ''}`}
                  type="button"
                  key={filter}
                  onClick={() => setActionFilter(filter)}
                  aria-pressed={actionFilter === filter}
                >
                  {label}<span>{filterCounts[filter]}</span>
                </button>
              ))}
            </div>

            {error && <p className="message message-error" role="alert">{error}</p>}

            {visibleActions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-emblem" aria-hidden="true">⚔</div>
                <h3>{actions.length === 0 ? 'Your story starts here' : 'No actions in this group'}</h3>
                <p>
                  {actions.length === 0
                    ? 'Add an attack, a healing spell, or any action you want to roll.'
                    : 'Link an action to this group when you create or edit it.'}
                </p>
              </div>
            ) : (
              <ul className="attack-list">
                {actionGroups.map((group) => (
                  <li className="action-group" key={group.key}>
                    <h3 className="action-group-heading">
                      <span className={`group-mark${group.type ? ` group-${group.type}` : ''}`} aria-hidden="true">
                        {group.type === 'enemy' ? '♟' : group.type === 'character' ? '♙' : '✧'}
                      </span>
                      {group.label}
                      {group.type && <span className="group-type">{group.type}</span>}
                    </h3>
                    <ul className="group-action-list">
                      {group.actions.map((action) => (
                        <li className="attack-card" key={action.id}>
                          <div className="attack-symbol" aria-hidden="true">✧</div>
                          <div className="attack-details">
                            <h3>{action.name}</h3>
                            <p>
                              {action.num_dice}<span className="notation-d">d</span>{action.dice_sides}
                              {action.modifier > 0 ? ` + ${action.modifier}` : action.modifier < 0 ? ` − ${Math.abs(action.modifier)}` : ''}
                              <span className="damage-label">
                                {action.level_scaling
                                  ? ` + ${action.level_scaling.num_dice}d${action.level_scaling.dice_sides} / LEVEL`
                                  : ' PER USE'}
                              </span>
                            </p>
                          </div>
                          {action.level_scaling && (
                            <label className="action-level-control">
                              <span>LEVEL</span>
                              <input
                                type="number"
                                value={actionLevels[action.id] ?? action.level_scaling.base_level}
                                onChange={(event) => setActionLevels((currentLevels) => ({
                                  ...currentLevels,
                                  [action.id]: event.target.value,
                                }))}
                                min={action.level_scaling.base_level}
                                max={MAX_ACTION_LEVEL}
                                step="1"
                                aria-label={`${action.name} use level`}
                              />
                            </label>
                          )}
                          <button className="button button-roll" type="button" onClick={() => rollAction(action)}>
                            Roll <span aria-hidden="true">↗</span>
                          </button>
                          <button
                            className="icon-button edit-button"
                            type="button"
                            onClick={() => editAction(action)}
                            aria-label={`Edit ${action.name}`}
                            title="Edit action"
                          >
                            ✎
                          </button>
                          <button
                            className="icon-button delete-button"
                            type="button"
                            onClick={() => deleteAction(action.id)}
                            aria-label={`Delete ${action.name}`}
                            title="Delete action"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}

          </section>
        </div>

        <section className="backup-bar">
          <div className="backup-copy">
            <span className="backup-icon" aria-hidden="true">✧</span>
            <div>
              <strong>Carry your actions with you</strong>
              <p>Save your collection as a file, or restore it from a previous export.</p>
            </div>
          </div>
          <label className="filename-field">
            <span>FILE NAME</span>
            <input
              type="text"
              value={exportFilename}
              onChange={(event) => setExportFilename(event.target.value)}
              aria-label="Export filename"
            />
            <span className="file-extension">.json</span>
          </label>
        </section>

        <footer className="footer">
          <span>ROLL WITH COURAGE <span aria-hidden="true">✦</span></span>
          <a className="text-button footer-reset" href="/privacy.html">Privacy</a>
          <button className="text-button footer-reset" type="button" onClick={resetActions}>Reset actions</button>
        </footer>

      </main>
    </div>
  );
}

export default App;