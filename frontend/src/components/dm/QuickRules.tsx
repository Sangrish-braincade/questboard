import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Search, X, BookOpen } from 'lucide-react';

interface QuickRulesProps {
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

const QuickRules: React.FC<QuickRulesProps> = ({ isOpen: initialOpen = false, onToggle }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [expandedSection, setExpandedSection] = useState<string | null>('conditions');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    onToggle?.(open);
  };

  const sections = [
    {
      id: 'conditions',
      title: 'Conditions',
      items: [
        { name: 'Blinded', short: 'Can\'t see. Fails sight checks. Attacks have disadvantage, attacks vs. have advantage.' },
        { name: 'Charmed', short: 'Can\'t attack charmer. Charmer has advantage on social checks.' },
        { name: 'Deafened', short: 'Can\'t hear. Fails hearing checks.' },
        { name: 'Frightened', short: 'Disadvantage on checks/attacks while source in sight. Can\'t move closer.' },
        { name: 'Grappled', short: 'Speed = 0. Condition ends if grappler is incapacitated.' },
        { name: 'Incapacitated', short: 'Can\'t take actions or bonus actions.' },
        { name: 'Invisible', short: 'Unseen. Attacks vs. have disadvantage, your attacks have advantage.' },
        { name: 'Paralyzed', short: 'Incapacitated. Fails STR/DEX saves. Attacks vs. have advantage. Hits within 5ft are crits.' },
        { name: 'Petrified', short: 'Turned to stone. Incapacitated. Immune to poison/disease (suspended).' },
        { name: 'Poisoned', short: 'Disadvantage on attacks and checks.' },
        { name: 'Prone', short: 'Can only crawl. Disadvantage on melee attacks. Attacks vs. within 5ft have advantage.' },
        { name: 'Restrained', short: 'Speed = 0. Attacks vs. have advantage. Disadvantage on DEX saves.' },
        { name: 'Stunned', short: 'Incapacitated. Can\'t move. Fails STR/DEX saves. Attacks vs. have advantage.' },
        { name: 'Unconscious', short: 'Incapacitated, unaware. Fails STR/DEX saves. Attacks vs. within 5ft are crits.' },
      ],
    },
    {
      id: 'actions',
      title: 'Combat Actions',
      items: [
        { name: 'Attack', short: 'Make one melee or ranged attack.' },
        { name: 'Cast Spell', short: 'Cast spell with 1 action casting time.' },
        { name: 'Dash', short: 'Move up to your speed.' },
        { name: 'Disengage', short: 'Movement doesn\'t provoke opportunity attacks.' },
        { name: 'Dodge', short: 'Attack rolls vs. have disadvantage. Advantage on DEX saves.' },
        { name: 'Help', short: 'Grant advantage to nearby ally\'s attack or ability check.' },
        { name: 'Hide', short: 'Make Stealth check. Gain benefits of being hidden.' },
        { name: 'Ready', short: 'Ready action and trigger. Reaction when trigger occurs.' },
        { name: 'Grapple', short: 'STR (Athletics) vs. STR (Athletics) or DEX (Acrobatics).' },
        { name: 'Shove', short: 'STR (Athletics) vs. STR (Athletics) or DEX (Acrobatics). Prone or push 5 ft.' },
      ],
    },
    {
      id: 'cover',
      title: 'Cover Rules',
      items: [
        { name: 'Half Cover', short: '+2 AC and DEX saves (wall, tree, creature).' },
        { name: 'Three-Quarters Cover', short: '+5 AC and DEX saves (arrow slit, window).' },
        { name: 'Total Cover', short: 'Can\'t be targeted directly.' },
      ],
    },
    {
      id: 'dcs',
      title: 'Difficulty Classes',
      items: [
        { name: 'DC 10 (Easy)', short: 'Obvious clues, routine tasks.' },
        { name: 'DC 15 (Medium)', short: 'Uncommon knowledge, moderate difficulty.' },
        { name: 'DC 20 (Hard)', short: 'Obscure knowledge, significant challenge.' },
        { name: 'DC 25 (Nearly Impossible)', short: 'Rare knowledge, extreme difficulty.' },
        { name: 'DC 30 (Godly)', short: 'Miracles, breaking nature laws.' },
      ],
    },
    {
      id: 'vision',
      title: 'Light & Vision',
      items: [
        { name: 'Bright Light', short: 'See normally. Colors and details clear.' },
        { name: 'Dim Light', short: 'Like shadows. Darkvision sees as bright light.' },
        { name: 'Darkness', short: 'Can\'t see. Blind for combat.' },
        { name: 'Darkvision (60-120 ft)', short: 'See in darkness as dim light. No color.' },
        { name: 'Blindsight', short: 'Perceive without sight. Detect invisible creatures.' },
        { name: 'Truesight', short: 'See in darkness, invisible creatures, original forms.' },
      ],
    },
    {
      id: 'concentration',
      title: 'Concentration',
      items: [
        { name: 'Taking Damage', short: 'CON save (DC = half damage, min 10) or lose concentration.' },
        { name: 'Incapacitated/Killed', short: 'Automatically lose concentration.' },
        { name: 'Casting Another Spell', short: 'Lose concentration on previous concentration spell.' },
      ],
    },
    {
      id: 'travel',
      title: 'Travel Pace',
      items: [
        { name: 'Slow (2 mi/hr)', short: '18 mi/day. Can use stealth. Normal senses.' },
        { name: 'Normal (3 mi/hr)', short: '24 mi/day. Disadvantage on Perception.' },
        { name: 'Fast (4 mi/hr)', short: '30 mi/day. Disadvantage on Perception and CON saves.' },
      ],
    },
  ];

  const filteredSections = sections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.short.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((section) => section.items.length > 0);

  if (!isOpen) {
    return (
      <button
        onClick={() => handleToggle(true)}
        className="fixed bottom-6 right-6 bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-full shadow-lg transition hover:scale-110 z-40 flex items-center gap-2"
        title="Open Quick Rules"
      >
        <BookOpen size={24} />
        <span className="text-sm font-bold">Rules</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-[600px] bg-slate-900 border-2 border-amber-600 rounded-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-700 border-b border-amber-600 p-4 flex justify-between items-center">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <BookOpen size={20} />
          Quick Rules
        </h2>
        <button
          onClick={() => handleToggle(false)}
          className="text-white hover:bg-red-700 p-1 rounded transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-800 border-b border-slate-700 p-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 text-amber-600" size={16} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700 text-white placeholder-slate-400 rounded pl-8 pr-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {filteredSections.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            No results for "{searchQuery}"
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredSections.map((section) => (
              <div key={section.id} className="bg-slate-900">
                <button
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === section.id ? null : section.id
                    )
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition"
                >
                  <h3 className="text-amber-400 font-bold text-sm">{section.title}</h3>
                  {expandedSection === section.id ? (
                    <ChevronUp size={18} className="text-amber-600" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>

                {expandedSection === section.id && (
                  <div className="bg-slate-800 border-t border-slate-700 divide-y divide-slate-700">
                    {section.items.map((item, idx) => (
                      <div key={idx} className="px-4 py-3 hover:bg-slate-700 transition">
                        <p className="text-amber-300 text-xs font-bold mb-1">
                          {item.name}
                        </p>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {item.short}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 text-xs text-slate-500 text-center">
        D&D 5e Quick Reference
      </div>
    </div>
  );
};

export default QuickRules;
