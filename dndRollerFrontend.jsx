import React, { useEffect, useRef, useState } from 'react';


const STORAGE_KEY = 'dnd-roller-attacks';
const HIT_MODIFIER_STORAGE_KEY = 'dnd-roller-hit-modifier';
const EXPORT_FORMAT = 'dnd-roller-actions';
const LEGACY_EXPORT_FORMAT = 'dnd-roller-attacks';
const EXPORT_VERSION = 3;

function createActionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeAction(rawAction, fallbackId = Date.now()) {
  const name = String(rawAction?.name ?? '').trim();
  const numDice = Number(rawAction?.num_dice ?? rawAction?.numDice ?? 0);
  const diceSides = Number(rawAction?.dice_sides ?? rawAction?.diceSides ?? 0);
  const modifier = Number(rawAction?.modifier ?? 0);
  const ownerName = String(rawAction?.owner_name ?? rawAction?.ownerName ?? '').trim();
  const rawOwnerType = rawAction?.owner_type ?? rawAction?.ownerType ?? '';
  const ownerType = ownerName ? rawOwnerType : '';

  if (
    !name ||
    !Number.isInteger(numDice) ||
    !Number.isInteger(diceSides) ||
    !Number.isInteger(modifier) ||
    numDice <= 0 ||
    diceSides <= 0 ||
    (ownerName && !['character', 'enemy'].includes(ownerType))
  ) {
    throw new Error('Invalid action data.');
  }

  return {
    id: String(rawAction?.id ?? fallbackId),
    name,
    num_dice: numDice,
    dice_sides: diceSides,
    modifier,
    owner_type: ownerType || null,
    owner_name: ownerName,
  };
}



function AdUnit() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Could not initialize the AdSense ad:', error);
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-5892740761307224"
      data-ad-slot="6608911347"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

function App() {
  const fileInputRef = useRef(null);
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
  const [newAction, setNewAction] = useState({
    name: '',
    numDice: '',
    diceSides: '',
    modifier: '',
    ownerType: '',
    ownerName: '',
  });
  const [actionFilter, setActionFilter] = useState('all');
  const [rollResult, setRollResult] = useState('');
  const [isCriticalHit, setIsCriticalHit] = useState(false);
  const [error, setError] = useState('');

  
  useEffect(() => {
    if (window.location.hash === '#privacy') {
      document.getElementById('privacy-title')?.scrollIntoView({ block: 'start' });
    }
  }, []);

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

  function addAction(event) {
    event.preventDefault();
    setError('');

    const name = newAction.name.trim();
    const numDice = Number(newAction.numDice);
    const diceSides = Number(newAction.diceSides);
    const modifier = Number(newAction.modifier || 0);
    const ownerName = newAction.ownerName.trim();

    if (
      !name ||
      !Number.isInteger(numDice) ||
      !Number.isInteger(diceSides) ||
      !Number.isInteger(modifier) ||
      numDice <= 0 ||
      diceSides <= 0 ||
      (newAction.ownerType && !ownerName)
    ) {
      setError('Enter an action name, valid dice values, and a name for the selected character or enemy.');
      return;
    }

    const action = {
      id: createActionId(),
      name,
      num_dice: numDice,
      dice_sides: diceSides,
      modifier,
      owner_type: newAction.ownerType || null,
      owner_name: ownerName,
    };

    setActions((currentActions) => [...currentActions, action]);
    setNewAction({ name: '', numDice: '', diceSides: '', modifier: '', ownerType: '', ownerName: '' });
    setError('');
  }

  function deleteAction(id) {
    setActions((currentActions) => currentActions.filter((action) => action.id !== id));
  }

  function rollAction(action) {
    const rolls = Array.from({ length: action.num_dice }, () => Math.floor(Math.random() * action.dice_sides) + 1);
    const total = rolls.reduce((sum, value) => sum + value, 0) + action.modifier;

    setIsCriticalHit(false);
    setRollResult(`${action.name}: ${action.num_dice}d${action.dice_sides} (${rolls.join(', ')})\nTotal: ${total}`);
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
          [1, 2, EXPORT_VERSION].includes(parsed?.version) &&
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
    <div className="page-layout">
      <aside className="ad-rail" aria-label="Advertisement">
        <AdUnit />
    </aside>
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
            <h1>Make every move<br /><em>legendary.</em></h1>
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
          <section className="panel forge-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR ADVENTURER'S KIT</p>
                <h2>Create an action</h2>
              </div>
              <span className="heading-icon" aria-hidden="true">⚒</span>
            </div>
            <form className="attack-form" onSubmit={addAction}>
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
              <button className="button button-primary field-wide" type="submit">
                <span aria-hidden="true">✦</span> Save action
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
                    : 'Link an action to this group when you create it.'}
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
                              <span className="damage-label"> PER USE</span>
                            </p>
                          </div>
                          <button className="button button-roll" type="button" onClick={() => rollAction(action)}>
                            Roll <span aria-hidden="true">↗</span>
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

        <section className="panel forge-panel privacy-panel" id="privacy" aria-labelledby="privacy-title">
          <p className="eyebrow">YOUR DATA, YOUR ADVENTURE</p>
          <h2 id="privacy-title">Privacy statement</h2>
          <p><strong>Last updated: November 10, 2026</strong></p>

          <h3>Information stored by this app</h3>
          <p>
            The Dice Vault does not require an account and does not send your saved actions or roll-to-hit
            modifier to an app server. These items are stored in local storage in the browser you are using.
            They stay on that browser and device unless you clear its site data. They are not synced between
            browsers or devices. Anyone with access to the same browser profile may also be able to access them.
          </p>
          <p>
            When you import an actions file, the file is read in your browser and its contents replace your
            saved list after you confirm. When you export, the browser downloads a JSON file to your device.
            The app does not upload either file.
          </p>

          <h3>Service providers</h3>
          <p>
            This website is hosted by Cloudflare. When your browser requests the site, Cloudflare may process
            technical request information such as your IP address, browser details, and requested pages to
            deliver and protect the service. See the{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
              Cloudflare Privacy Policy
            </a>.
          </p>
          <p>
            The site loads fonts from Google Fonts. Your browser connects to Google to retrieve those font
            files, which may provide Google with technical information such as your IP address. See{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Google’s Privacy Policy
            </a>.
          </p>

         <h3>Advertising and cookies</h3>
          <p>
            This site uses Google AdSense to display ads. Google and its advertising partners may use cookies
            or similar technologies to serve and measure ads, including personalized ads based on your visits
            to this site or other sites. These technologies may collect or receive information such as your
            IP address, browser or device information, and interactions with ads. Google's advertising cookies
            may be used by Google and its partners for these purposes.
          </p>
          <p>
            You can manage personalized advertising through{' '}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
              Google Ads Settings
            </a>
            . You can also visit{' '}
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">
              YourAdChoices
            </a>{' '}
            to learn about opting out of some participating companies' interest-based advertising.
            Opting out does not necessarily stop ads from appearing; ads may be less relevant.
          </p>
          <p>
            Depending on the ad settings for this site, other third-party ad providers may also use cookies
            or similar technologies. For visitors in the European Economic Area, the United Kingdom, and
            Switzerland, Google requires publishers to obtain consent for certain cookies and personalized
            advertising uses where applicable. Your choices may be presented through the site's consent
            message, if shown.
          </p>
          <p>
            The app does not currently use a separate analytics service. Hosting and font providers may
            process technical information as described above and in their own privacy policies.
          </p>

          <h3>Contact</h3>
          <p>
            For privacy questions, contact the site owner at <a href="mailto:Thedicevaultemail@gmail.com">Thedicevaultemail@gmail.com</a>.
          </p>
        </section>
        </main>
    </div>
  </div>
  );
}

export default App;
