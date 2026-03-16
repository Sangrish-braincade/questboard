import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface DMScreenProps {
  onClose?: () => void;
}

const DMScreen: React.FC<DMScreenProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('conditions');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const tabs = [
    { id: 'conditions', label: 'Conditions' },
    { id: 'actions', label: 'Combat Actions' },
    { id: 'cover', label: 'Cover Rules' },
    { id: 'dcs', label: 'Difficulty Classes' },
    { id: 'travel', label: 'Travel Pace' },
    { id: 'vision', label: 'Light & Vision' },
    { id: 'concentration', label: 'Concentration' },
    { id: 'tables', label: 'Quick Tables' },
  ];

  const conditionsData = [
    {
      name: 'Blinded',
      effects: 'Can\'t see. Automatically fails any ability check that requires sight. Attack rolls against the creature have advantage. Attack rolls by the creature have disadvantage.',
    },
    {
      name: 'Charmed',
      effects: 'Can\'t attack the charmer or target the charmer with harmful abilities/magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    },
    {
      name: 'Deafened',
      effects: 'Can\'t hear. Automatically fails any ability check that requires hearing.',
    },
    {
      name: 'Frightened',
      effects: 'Has disadvantage on ability checks and attack rolls while the source of fear is within line of sight. The creature can\'t willingly move closer to the source of fear.',
    },
    {
      name: 'Grappled',
      effects: 'Speed is 0 and can\'t benefit from bonuses to speed. Condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the grappler\'s reach.',
    },
    {
      name: 'Incapacitated',
      effects: 'Can\'t take actions or bonus actions.',
    },
    {
      name: 'Invisible',
      effects: 'Unseen. For the purpose of hiding, the creature is heavily obscured. The creature\'s location can be detected by any noise it makes or any tracks it leaves. Attack rolls against the creature have disadvantage, and the creature\'s attack rolls have advantage.',
    },
    {
      name: 'Paralyzed',
      effects: 'Incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    },
    {
      name: 'Petrified',
      effects: 'Transformed along with any nonmagical object worn into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging. Incapacitated and can\'t move or speak. Unaware of its surroundings. Immune to poison and disease, though a poison or disease already in its system is only suspended. Resistant to all damage, immune to poison and psychic damage. Knows the passage of time but is aware of nothing else unless targeted by magic.',
    },
    {
      name: 'Poisoned',
      effects: 'Has disadvantage on attack rolls and ability checks.',
    },
    {
      name: 'Prone',
      effects: 'Can only move by crawling. Has disadvantage on melee attack rolls. A melee attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.',
    },
    {
      name: 'Restrained',
      effects: 'Speed is 0 and can\'t benefit from bonuses to speed. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.',
    },
    {
      name: 'Stunned',
      effects: 'Incapacitated. Can\'t move. Can speak only falteringly. Fails Strength and Dexterity saving throws. Attack rolls against it have advantage.',
    },
    {
      name: 'Unconscious',
      effects: 'Incapacitated and unable to move or speak. Unaware of surroundings. Drops held items and falls prone. Falls unconscious if it takes damage while already unconscious. Otherwise, one failed death saving throw is triggered if damage is taken.',
    },
    {
      name: 'Exhaustion (Levels 1-6)',
      effects: 'Level 1: Disadvantage on ability checks. Level 2: Speed halved. Level 3: Disadvantage on attack rolls and saving throws. Level 4: Speed reduced to 0. Level 5: Speed 0, resistance to all damage. Level 6: Death.',
    },
  ];

  const actionsData = [
    { name: 'Attack', description: 'Make one melee or ranged attack.' },
    { name: 'Cast a Spell', description: 'Cast a spell with a casting time of 1 action.' },
    { name: 'Dash', description: 'Move up to your speed.' },
    { name: 'Disengage', description: 'Movement provokes no opportunity attacks from enemies you can see.' },
    { name: 'Dodge', description: 'Until end of turn, attack rolls against you have disadvantage. You make Dexterity saves with advantage.' },
    { name: 'Help', description: 'Give advantage to creature\'s attack within 5 ft, or help with ability check.' },
    { name: 'Hide', description: 'Make a Stealth check. If successful, gain benefits of being hidden.' },
    { name: 'Ready', description: 'Choose action you can normally take and triggering circumstance. Reaction when trigger occurs.' },
    { name: 'Search', description: 'Spend time looking for something.' },
    { name: 'Use an Object', description: 'Interact with an object, open door, draw weapon, drink potion, etc.' },
    { name: 'Grapple', description: 'Make Strength (Athletics) check against target\'s Strength (Athletics) or Dexterity (Acrobatics). Success: creature is grappled.' },
    { name: 'Shove', description: 'Make Strength (Athletics) check against target\'s Strength (Athletics) or Dexterity (Acrobatics). Success: knock prone or push 5 ft away.' },
  ];

  const coverData = [
    { name: 'Half Cover', ac: '+2', saves: '+2', description: 'Wall, tree, creature. +2 bonus to AC and Dexterity saving throws.' },
    { name: 'Three-Quarters Cover', ac: '+5', saves: '+5', description: 'Arrow slit, window, crenellation. +5 bonus to AC and Dexterity saving throws.' },
    { name: 'Total Cover', ac: 'Immune', saves: 'Immune', description: 'Can\'t be targeted directly by attacks or spells.' },
  ];

  const dcsData = [
    { dc: 10, difficulty: 'Easy', example: 'Spot obvious clues, climb a rope, recall common knowledge' },
    { dc: 15, difficulty: 'Medium', example: 'Recall uncommon knowledge, spot hidden object, climb slippery wall' },
    { dc: 20, difficulty: 'Hard', example: 'Recall obscure knowledge, pick complex lock, seduce skeptical noble' },
    { dc: 25, difficulty: 'Nearly Impossible', example: 'Recall extremely rare knowledge, scale sheer cliff, forge masterwork' },
    { dc: 30, difficulty: 'Godly', example: 'Miracles, breaking fundamental laws of nature' },
  ];

  const travelData = [
    {
      pace: 'Slow',
      hour: '2 miles',
      day: '18 miles',
      benefit: 'Able to use stealth. Can use senses normally.',
    },
    {
      pace: 'Normal',
      hour: '3 miles',
      day: '24 miles',
      benefit: 'Standard pace. Disadvantage on Wisdom (Perception) checks.',
    },
    {
      pace: 'Fast',
      hour: '4 miles',
      day: '30 miles',
      benefit: 'Disadvantage on Wisdom (Perception) checks, Constitution saves to avoid exhaustion.',
    },
  ];

  const visionData = [
    {
      type: 'Bright Light',
      range: '-',
      description: 'Creatures can see normally. Colors and details are clear.',
    },
    {
      type: 'Dim Light',
      range: '-',
      description: 'Same as shadows. Creatures with darkvision see it as bright light.',
    },
    {
      type: 'Darkness',
      range: '-',
      description: 'Creatures can\'t see. Blind for combat purposes.',
    },
    {
      type: 'Darkvision',
      range: '60-120 ft',
      description: 'See in darkness as if it were dim light. Can\'t discern color, only shades of gray.',
    },
    {
      type: 'Blindsight',
      range: 'Varies',
      description: 'Perceive surroundings without relying on sight. Perceive invisible creatures.',
    },
    {
      type: 'Truesight',
      range: 'Varies',
      description: 'See in normal and magical darkness, see invisible creatures, perceive original form of shapeshifters.',
    },
  ];

  const concentrationData = [
    {
      rule: 'Taking Damage',
      dc: 'Half damage taken (min 10)',
      description: 'Make a Constitution save or lose concentration. DC is half the damage taken.',
    },
    {
      rule: 'Being Incapacitated or Killed',
      dc: 'Automatic fail',
      description: 'You lose concentration on a spell if you are incapacitated or killed.',
    },
    {
      rule: 'Casting Another Spell',
      dc: 'Automatic fail',
      description: 'If you cast another spell that requires concentration, you lose concentration on the previous one.',
    },
  ];

  const searchableContent = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return null;

    const results: Array<{ type: string; title: string; content: string }> = [];

    conditionsData.forEach((cond) => {
      if (cond.name.toLowerCase().includes(query) || cond.effects.toLowerCase().includes(query)) {
        results.push({ type: 'Condition', title: cond.name, content: cond.effects });
      }
    });

    actionsData.forEach((action) => {
      if (action.name.toLowerCase().includes(query) || action.description.toLowerCase().includes(query)) {
        results.push({ type: 'Action', title: action.name, content: action.description });
      }
    });

    return results.length > 0 ? results : [];
  }, [searchQuery]);

  const renderConditions = () => (
    <div className="space-y-4">
      {conditionsData.map((condition) => (
        <div key={condition.name} className="border-l-4 border-amber-600 bg-slate-800 p-4 rounded">
          <h4 className="font-bold text-amber-400 mb-2">{condition.name}</h4>
          <p className="text-slate-300 text-sm leading-relaxed">{condition.effects}</p>
        </div>
      ))}
    </div>
  );

  const renderActions = () => (
    <div className="space-y-3">
      {actionsData.map((action) => (
        <div key={action.name} className="bg-slate-800 p-3 rounded border-l-4 border-amber-600">
          <h4 className="font-bold text-amber-400">{action.name}</h4>
          <p className="text-slate-300 text-sm mt-1">{action.description}</p>
        </div>
      ))}
    </div>
  );

  const renderCover = () => (
    <div className="space-y-4">
      {coverData.map((cover) => (
        <div key={cover.name} className="bg-slate-800 p-4 rounded border-l-4 border-amber-600">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-amber-400">{cover.name}</h4>
            <div className="text-right">
              <p className="text-xs text-slate-400">AC Bonus</p>
              <p className="text-amber-400 font-bold">{cover.ac}</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm">{cover.description}</p>
        </div>
      ))}
    </div>
  );

  const renderDCs = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-amber-600">
            <th className="text-left py-2 px-3 text-amber-400 font-bold">DC</th>
            <th className="text-left py-2 px-3 text-amber-400 font-bold">Difficulty</th>
            <th className="text-left py-2 px-3 text-amber-400 font-bold">Example Task</th>
          </tr>
        </thead>
        <tbody>
          {dcsData.map((row) => (
            <tr key={row.dc} className="border-b border-slate-700 hover:bg-slate-800 transition">
              <td className="py-2 px-3 font-bold text-amber-400">{row.dc}</td>
              <td className="py-2 px-3 text-slate-300">{row.difficulty}</td>
              <td className="py-2 px-3 text-slate-400">{row.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTravel = () => (
    <div className="space-y-4">
      {travelData.map((travel) => (
        <div key={travel.pace} className="bg-slate-800 p-4 rounded border-l-4 border-amber-600">
          <h4 className="font-bold text-amber-400 mb-3">{travel.pace} Pace</h4>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-slate-400">Per Hour</p>
              <p className="text-amber-400 font-bold">{travel.hour}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Per Day (8 hrs)</p>
              <p className="text-amber-400 font-bold">{travel.day}</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm">{travel.benefit}</p>
        </div>
      ))}
    </div>
  );

  const renderVision = () => (
    <div className="space-y-4">
      {visionData.map((vision) => (
        <div key={vision.type} className="bg-slate-800 p-4 rounded border-l-4 border-amber-600">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-amber-400">{vision.type}</h4>
            {vision.range !== '-' && (
              <span className="text-amber-300 text-xs bg-slate-700 px-2 py-1 rounded">{vision.range}</span>
            )}
          </div>
          <p className="text-slate-300 text-sm">{vision.description}</p>
        </div>
      ))}
    </div>
  );

  const renderConcentration = () => (
    <div className="space-y-4">
      {concentrationData.map((item) => (
        <div key={item.rule} className="bg-slate-800 p-4 rounded border-l-4 border-amber-600">
          <h4 className="font-bold text-amber-400 mb-1">{item.rule}</h4>
          <p className="text-amber-300 text-xs mb-2 font-semibold">DC: {item.dc}</p>
          <p className="text-slate-300 text-sm">{item.description}</p>
        </div>
      ))}
      <div className="bg-slate-700 p-4 rounded border-l-4 border-blue-500 mt-6">
        <h4 className="font-bold text-blue-400 mb-2">Common Concentration Spells</h4>
        <p className="text-slate-300 text-sm">Most control, damage, and buff spells require concentration. The DMG and spell descriptions will specify. Concentration lasts up to the spell's duration but ends early if concentration is broken.</p>
      </div>
    </div>
  );

  const renderTables = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-bold text-amber-400 mb-3 text-lg">Damage by Spell Slot Level</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-amber-600">
                <th className="text-left py-2 px-3 text-amber-400 font-bold">Spell Level</th>
                <th className="text-left py-2 px-3 text-amber-400 font-bold">Damage (d6)</th>
                <th className="text-left py-2 px-3 text-amber-400 font-bold">Example</th>
              </tr>
            </thead>
            <tbody>
              {[
                { level: '1st', damage: '2d6', example: 'Magic Missile' },
                { level: '2nd', damage: '3d6', example: 'Scorching Ray' },
                { level: '3rd', damage: '4d6', example: 'Fireball' },
                { level: '4th', damage: '5d6', example: 'Storm Sphere' },
                { level: '5th+', damage: '6d6', example: 'Cone of Cold' },
              ].map((row) => (
                <tr key={row.level} className="border-b border-slate-700 hover:bg-slate-800 transition">
                  <td className="py-2 px-3 text-amber-400 font-bold">{row.level}</td>
                  <td className="py-2 px-3 text-slate-300">{row.damage}</td>
                  <td className="py-2 px-3 text-slate-400">{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-amber-400 mb-3 text-lg">Armor Class Quick Reference</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { armor: 'Leather', ac: 11 },
            { armor: 'Studded Leather', ac: 12 },
            { armor: 'Hide', ac: 12 },
            { armor: 'Chain Shirt', ac: 13 },
            { armor: 'Scale Mail', ac: 14 },
            { armor: 'Breastplate', ac: 14 },
            { armor: 'Splint', ac: 17 },
            { armor: 'Plate', ac: 18 },
          ].map((item) => (
            <div key={item.armor} className="bg-slate-800 p-3 rounded border-l-4 border-amber-600 flex justify-between items-center">
              <span className="text-slate-300 text-sm">{item.armor}</span>
              <span className="text-amber-400 font-bold">{item.ac}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSearchResults = () => {
    if (searchableContent === null) return null;
    if (searchableContent === false) {
      return (
        <div className="text-center py-8">
          <p className="text-slate-400">No results found for "{searchQuery}"</p>
        </div>
      );
    }
    if (Array.isArray(searchableContent)) {
      return (
        <div className="space-y-4">
          {searchableContent.map((result, idx) => (
            <div key={idx} className="bg-slate-800 p-4 rounded border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-amber-400">{result.title}</h4>
                <span className="text-blue-400 text-xs bg-slate-700 px-2 py-1 rounded">{result.type}</span>
              </div>
              <p className="text-slate-300 text-sm">{result.content}</p>
            </div>
          ))}
        </div>
      );
    }
  };

  const renderContent = () => {
    if (searchQuery) {
      return renderSearchResults();
    }

    switch (activeTab) {
      case 'conditions':
        return renderConditions();
      case 'actions':
        return renderActions();
      case 'cover':
        return renderCover();
      case 'dcs':
        return renderDCs();
      case 'travel':
        return renderTravel();
      case 'vision':
        return renderVision();
      case 'concentration':
        return renderConcentration();
      case 'tables':
        return renderTables();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-2 border-amber-600">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b-2 border-amber-600 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">DM Screen</h1>
            <p className="text-slate-400 text-sm mt-1">D&D 5e Quick Reference</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-700 hover:bg-red-700 text-white p-2 rounded transition"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-amber-600" size={20} />
            <input
              type="text"
              placeholder="Search all rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white placeholder-slate-400 rounded pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-800 border-b border-slate-700 overflow-x-auto">
          <div className="flex gap-2 p-4 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DMScreen;
