import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { BlockyAvatar, SKIN_COLORS, HAIR_COLORS, BEARD_COLORS } from './BlockyAvatar';

// Vector Icon Components for the Tabs
const MaleFemaleIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Male symbol */}
    <circle cx="8" cy="16" r="3" />
    <path d="M11 13l4-4M15 9h-3M15 9v3" />
    {/* Female symbol */}
    <circle cx="16" cy="7" r="3" />
    <path d="M16 10v4M14 12h4" />
  </svg>
);

const PaletteIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.5 3.5 16.5 5.5 17.5C6 17.75 6.5 18.25 6.5 19C6.5 20.5 5.5 21.5 4.5 22H12Z" />
    <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
  </svg>
);

const ScissorsIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="9.8" y1="8.2" x2="20" y2="18.4" />
    <line x1="9.8" y1="15.8" x2="20" y2="5.6" />
  </svg>
);

const BeardIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11c1.5-2.5 4.5-3.5 7-2c1 .6 1.7 1.5 2 2.5c.3-1 .9-1.9 2-2.5c2.5-1.5 5.5-.5 7 2c.8 1.3.5 3-.7 3.7c-2.3 1.3-4.8.8-6.3-1.2c-1-1.3-3-1.3-4 0c-1.5 2-4 2.5-6.3 1.2c-1.2-.7-1.5-2.4-.7-3.7z" />
  </svg>
);

export function AvatarCustomizer() {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [skin, setSkin] = useState<string>('1');
  const [hair, setHair] = useState<string>('1');
  const [beard, setBeard] = useState<string>('1');
  
  // Tab selector state
  const [activeTab, setActiveTab] = useState<'gender' | 'skin' | 'hair' | 'beard'>('gender');

  // If gender changes to female, reset beard style to clean shaved ('1')
  useEffect(() => {
    if (gender === 'female') {
      setBeard('1');
      if (activeTab === 'beard') {
        setActiveTab('gender');
      }
    }
  }, [gender, activeTab]);

  const handleRandomize = () => {
    const genders = ['male', 'female'] as const;
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    const randomSkin = Math.floor(1 + Math.random() * 5).toString();
    const randomHair = Math.floor(1 + Math.random() * 5).toString();
    let randomBeard = '1';
    if (randomGender === 'male') {
      randomBeard = Math.floor(1 + Math.random() * 5).toString();
    }
    
    setGender(randomGender);
    setSkin(randomSkin);
    setHair(randomHair);
    setBeard(randomBeard);
  };

  const configString = `${gender}-${skin}-${hair}-${beard}`;

  const skinPresetNames = ['peach', 'tan', 'golden', 'bronze', 'dark'];
  const hairPresetNames = ['steve classic', 'alex bangs', 'neon mohawk', 'curly afro', 'bandana cap'];
  const beardPresetNames = ['clean shaved', 'mustache', 'goatee', 'full beard', 'stubble'];

  // Handle Chevron Left Click
  const handlePrevOption = () => {
    if (activeTab === 'gender') {
      setGender(gender === 'male' ? 'female' : 'male');
    } else if (activeTab === 'skin') {
      const current = parseInt(skin);
      const prevVal = current === 1 ? 5 : current - 1;
      setSkin(prevVal.toString());
    } else if (activeTab === 'hair') {
      const current = parseInt(hair);
      const prevVal = current === 1 ? 5 : current - 1;
      setHair(prevVal.toString());
    } else if (activeTab === 'beard') {
      const current = parseInt(beard);
      const prevVal = current === 1 ? 5 : current - 1;
      setBeard(prevVal.toString());
    }
  };

  // Handle Chevron Right Click
  const handleNextOption = () => {
    if (activeTab === 'gender') {
      setGender(gender === 'male' ? 'female' : 'male');
    } else if (activeTab === 'skin') {
      const current = parseInt(skin);
      const nextVal = current === 5 ? 1 : current + 1;
      setSkin(nextVal.toString());
    } else if (activeTab === 'hair') {
      const current = parseInt(hair);
      const nextVal = current === 5 ? 1 : current + 1;
      setHair(nextVal.toString());
    } else if (activeTab === 'beard') {
      const current = parseInt(beard);
      const nextVal = current === 5 ? 1 : current + 1;
      setBeard(nextVal.toString());
    }
  };

  // Helper to determine text subtitle of the option
  const getSubtext = () => {
    if (activeTab === 'gender') return `model: ${gender}`;
    if (activeTab === 'skin') return `skin tone: ${skinPresetNames[parseInt(skin) - 1]}`;
    if (activeTab === 'hair') return `hairstyle: ${hairPresetNames[parseInt(hair) - 1]}`;
    return `beard style: ${beardPresetNames[parseInt(beard) - 1]}`;
  };

  return (
    <div className="w-full flex flex-col items-center p-0 font-mono text-white mb-2 sm:mb-6">
      
      {/* Hidden field for form submission */}
      <input type="hidden" name="avatar" value={configString} />

      {/* Main Row: Preview, Randomize on Left, Customization Category Icons on Right */}
      <div className="grid grid-cols-[2rem_6rem_2rem] sm:grid-cols-[2.5rem_8rem_2.5rem] items-center gap-3 sm:gap-6 justify-center">
        
        {/* Randomize Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleRandomize}
            className="w-8 h-8 sm:w-10 sm:h-10 border flex items-center justify-center bg-black text-gray-400 border-white/10 hover:border-white/20 hover:text-white transition-all rounded-none cursor-pointer hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]"
            title="Randomize style"
            aria-label="Randomize style"
          >
            <Shuffle size={14} className="sm:w-[16px] sm:h-[16px]" />
          </button>
        </div>

        {/* Preview Frame */}
        <div className="flex flex-col items-center gap-1.5 select-none">
          <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            avatar preview
          </div>
          <div className="p-1 bg-transparent w-24 h-24 sm:w-32 sm:h-32">
            <BlockyAvatar config={configString} size="responsive" />
          </div>
        </div>

        {/* Category Icons Stack */}
        <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2">
          
          {/* Gender Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('gender')}
            className={`w-8 h-8 sm:w-10 sm:h-10 border flex items-center justify-center transition-all rounded-none cursor-pointer ${
              activeTab === 'gender'
                ? 'bg-white text-black border-white shadow-[0_0_8px_#ffffff]'
                : 'bg-black text-gray-400 border-white/10 hover:border-white/20'
            }`}
            title="Gender Model"
            aria-label="Customize gender"
          >
            <MaleFemaleIcon />
          </button>

          {/* Skin Tone Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('skin')}
            className={`w-8 h-8 sm:w-10 sm:h-10 border flex items-center justify-center transition-all rounded-none cursor-pointer ${
              activeTab === 'skin'
                ? 'bg-white text-black border-white shadow-[0_0_8px_#ffffff]'
                : 'bg-black text-gray-400 border-white/10 hover:border-white/20'
            }`}
            title="Skin Tone"
            aria-label="Customize skin tone"
          >
            <PaletteIcon />
          </button>

          {/* Hairstyle Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('hair')}
            className={`w-8 h-8 sm:w-10 sm:h-10 border flex items-center justify-center transition-all rounded-none cursor-pointer ${
              activeTab === 'hair'
                ? 'bg-white text-black border-white shadow-[0_0_8px_#ffffff]'
                : 'bg-black text-gray-400 border-white/10 hover:border-white/20'
            }`}
            title="Hairstyle"
            aria-label="Customize hairstyle"
          >
            <ScissorsIcon />
          </button>

          {/* Beard Style Tab */}
          {gender === 'male' && (
            <button
              type="button"
              onClick={() => setActiveTab('beard')}
              className={`w-8 h-8 sm:w-10 sm:h-10 border flex items-center justify-center transition-all rounded-none cursor-pointer ${
                activeTab === 'beard'
                  ? 'bg-white text-black border-white shadow-[0_0_8px_#ffffff]'
                  : 'bg-black text-gray-400 border-white/10 hover:border-white/20'
              }`}
              title="Beard Style"
              aria-label="Customize beard style"
            >
              <BeardIcon />
            </button>
          )}

        </div>

      </div>

      {/* Subtext info */}
      <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mt-2 sm:mt-3.5 h-4 select-none">
        {getSubtext()}
      </div>

      {/* Bottom Option Slider */}
      <div className="w-full flex items-center gap-1 sm:gap-2 bg-transparent p-1 sm:p-2 rounded-none mt-1 sm:mt-2">
        
        {/* Left Slider Arrow */}
        <button
          type="button"
          onClick={handlePrevOption}
          className="p-1 bg-black border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all rounded-none cursor-pointer"
          title="Previous option"
          aria-label="Previous option"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Options Row (Horizontal Slider) */}
        <div className="flex-grow flex items-center justify-center gap-1 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 sm:py-1">
          
          {/* Gender choices */}
          {activeTab === 'gender' && (
            <>
              {/* Male Button */}
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`p-1 border flex flex-col items-center justify-center transition-all rounded-none cursor-pointer w-10 h-10 sm:w-14 sm:h-14 ${
                  gender === 'male'
                    ? 'border-[#a78bfa] bg-[#a78bfa]/10'
                    : 'border-white/10 bg-black hover:border-white/20'
                }`}
                title="Male model"
              >
                <div className="w-5 h-5 sm:w-8 sm:h-8 flex-shrink-0">
                  <BlockyAvatar config={`male-${skin}-${hair}-${beard}`} size="responsive" />
                </div>
                <span className="text-[7px] sm:text-[8px] font-bold mt-0.5 sm:mt-1 text-blue-300">♂</span>
              </button>

              {/* Female Button */}
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`p-1 border flex flex-col items-center justify-center transition-all rounded-none cursor-pointer w-10 h-10 sm:w-14 sm:h-14 ${
                  gender === 'female'
                    ? 'border-[#a78bfa] bg-[#a78bfa]/10'
                    : 'border-white/10 bg-black hover:border-white/20'
                }`}
                title="Female model"
              >
                <div className="w-5 h-5 sm:w-8 sm:h-8 flex-shrink-0">
                  <BlockyAvatar config={`female-${skin}-${hair}-1`} size="responsive" />
                </div>
                <span className="text-[7px] sm:text-[8px] font-bold mt-0.5 sm:mt-1 text-pink-300">♀</span>
              </button>
            </>
          )}

          {/* Skin choices */}
          {activeTab === 'skin' &&
            Object.keys(SKIN_COLORS).map((key) => {
              const isSelected = skin === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSkin(key)}
                  className={`p-1 border flex flex-col items-center justify-center transition-all rounded-none cursor-pointer w-10 h-10 sm:w-14 sm:h-14 ${
                    isSelected
                      ? 'border-[#a78bfa] bg-[#a78bfa]/10'
                      : 'border-white/10 bg-black hover:border-white/20'
                  }`}
                  title={skinPresetNames[parseInt(key) - 1]}
                >
                  <div className="w-5 h-5 sm:w-8 sm:h-8 flex-shrink-0">
                    <BlockyAvatar config={`${gender}-${key}-${hair}-${beard}`} size="responsive" />
                  </div>
                </button>
              );
            })}

          {/* Hair choices */}
          {activeTab === 'hair' &&
            Object.keys(HAIR_COLORS).map((key) => {
              const isSelected = hair === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setHair(key)}
                  className={`p-1 border flex flex-col items-center justify-center transition-all rounded-none cursor-pointer w-10 h-10 sm:w-14 sm:h-14 ${
                    isSelected
                      ? 'border-[#a78bfa] bg-[#a78bfa]/10'
                      : 'border-white/10 bg-black hover:border-white/20'
                  }`}
                  title={hairPresetNames[parseInt(key) - 1]}
                >
                  <div className="w-5 h-5 sm:w-8 sm:h-8 flex-shrink-0">
                    <BlockyAvatar config={`${gender}-${skin}-${key}-${beard}`} size="responsive" />
                  </div>
                </button>
              );
            })}

          {/* Beard choices */}
          {activeTab === 'beard' &&
            Object.keys(BEARD_COLORS).map((key) => {
              const isSelected = beard === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setBeard(key)}
                  className={`p-1 border flex flex-col items-center justify-center transition-all rounded-none cursor-pointer w-10 h-10 sm:w-14 sm:h-14 ${
                    isSelected
                      ? 'border-[#a78bfa] bg-[#a78bfa]/10'
                      : 'border-white/10 bg-black hover:border-white/20'
                  }`}
                  title={beardPresetNames[parseInt(key) - 1]}
                >
                  <div className="w-5 h-5 sm:w-8 sm:h-8 flex-shrink-0">
                    <BlockyAvatar config={`${gender}-${skin}-${hair}-${key}`} size="responsive" />
                  </div>
                </button>
              );
            })}

        </div>

        {/* Right Slider Arrow */}
        <button
          type="button"
          onClick={handleNextOption}
          className="p-1 bg-black border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all rounded-none cursor-pointer"
          title="Next option"
          aria-label="Next option"
        >
          <ChevronRight size={16} />
        </button>

      </div>

    </div>
  );
}
