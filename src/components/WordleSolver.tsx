import React, { useState, useEffect } from 'react';
import wordList from 'an-array-of-english-words';
import { Feedback, FeedbackColor, filterCandidates, getBestGuess } from '../utils/solver';
import clsx from 'clsx';

// Initial fallback list
const FALLBACK_WORDS = wordList.filter((w: string) => /^[a-z]+$/.test(w));

interface WordleSolverProps {}

export const WordleSolver: React.FC<WordleSolverProps> = () => {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [length, setLength] = useState<number>(5);
  const [inputLength, setInputLength] = useState<string>('5');
  
  // Dictionary state
  const [allWords, setAllWords] = useState<string[]>(FALLBACK_WORDS);
  const [officialWords, setOfficialWords] = useState<string[]>([]);
  const [isDictLoading, setIsDictLoading] = useState<boolean>(true);
  const [dictionary, setDictionary] = useState<string[]>([]);
  const [dictSource, setDictSource] = useState<string>('Extended');
  
  // Solver state
  const [candidates, setCandidates] = useState<string[]>([]);
  const [history, setHistory] = useState<{ word: string; feedback: Feedback }[]>([]);
  const [suggestedWord, setSuggestedWord] = useState<string>('');
  const [currentFeedback, setCurrentFeedback] = useState<Feedback>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load massive dictionary on mount
  useEffect(() => {
    setIsDictLoading(true);
    Promise.all([
      fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt').then(r => r.ok ? r.text() : Promise.reject('Failed to load big dictionary')),
      fetch('https://raw.githubusercontent.com/tabatkins/wordle-list/main/words').then(r => r.ok ? r.text() : Promise.reject('Failed to load official dictionary'))
    ])
    .then(([bigText, officialText]) => {
      const bigLines = bigText.split(/\r?\n/);
      const bigValid = bigLines.map(w => w.trim().toLowerCase()).filter(w => /^[a-z]+$/.test(w));
      if (bigValid.length > 50000) {
          setAllWords(bigValid);
      }

      const officialLines = officialText.split(/\r?\n/);
      const officialValid = officialLines.map(w => w.trim().toLowerCase()).filter(w => /^[a-z]+$/.test(w));
      if (officialValid.length > 2000) {
          setOfficialWords(officialValid);
      }
    })
    .catch(err => {
      console.warn("Dictionary fetch error (using fallback):", err);
    })
    .finally(() => {
      setIsDictLoading(false);
    });
  }, []);

  // Initialize dictionary based on length and allWords
  useEffect(() => {
    setLoading(true);
    const handler = setTimeout(() => {
      if (length === 5 && officialWords.length > 0) {
          // Use Official NYT list for standard Wordle
          setDictionary(officialWords);
          setCandidates(officialWords);
          setDictSource('Official (NYT)');
      } else {
          // Use Extended list for other lengths
          const filtered = allWords.filter((w: string) => w.length === length);
          setDictionary(filtered);
          setCandidates(filtered);
          setDictSource('Extended');
      }
      setHistory([]);
      setError(null);
      setLoading(false);
    }, 10);
    return () => clearTimeout(handler);
  }, [length, allWords, officialWords]);

  // Calculate best guess when candidates change
  useEffect(() => {
    if (candidates.length === 0) {
      setSuggestedWord('');
      return;
    }
    
    // Optimization for start of game (empty history)
    if (history.length === 0 && length === 5 && dictionary.length > 2000) {
        setSuggestedWord('stare'); // Good default opener
        setCurrentFeedback(Array(5).fill('gray'));
        return;
    }

    setLoading(true);
    const handler = setTimeout(() => {
      const best = getBestGuess(candidates, dictionary);
      setSuggestedWord(best);
      // Reset feedback to match new word length (though length is constant here, just safe)
      setCurrentFeedback(Array(length).fill('gray')); 
      setLoading(false);
    }, 10);
    return () => clearTimeout(handler);
  }, [candidates, dictionary, length, history.length]);

  const handleFeedbackChange = (index: number) => {
    const newFeedback = [...currentFeedback];
    const colors: FeedbackColor[] = ['gray', 'yellow', 'green'];
    const currentIndex = colors.indexOf(newFeedback[index]);
    newFeedback[index] = colors[(currentIndex + 1) % 3];
    setCurrentFeedback(newFeedback);
  };

  const handleSubmit = () => {
    if (!suggestedWord) return;

    // Check if solved
    const isSolved = currentFeedback.every(c => c === 'green');
    if (isSolved) {
        const entry = { word: suggestedWord, feedback: currentFeedback };
        setHistory(prev => [...prev, entry]);
        setCandidates([suggestedWord]); // Solved!
        return;
    }

    setLoading(true);
    setTimeout(() => {
      const nextCandidates = filterCandidates(candidates, suggestedWord, currentFeedback);
      if (nextCandidates.length === 0) {
          setError("No words match this feedback. Please check your input.");
          setLoading(false);
          return;
      }
      
      setHistory(prev => [...prev, { word: suggestedWord, feedback: currentFeedback }]);
      setCandidates(nextCandidates);
      setError(null);
      setLoading(false);
    }, 10);
  };

  const handleRestart = () => {
      setCandidates(dictionary);
      setHistory([]);
      setError(null);
  };

  const handleStartGame = () => {
      let val = parseInt(inputLength);
      if (isNaN(val) || val < 3) val = 3;
      if (val > 50) val = 50;
      setLength(val);
      setInputLength(val.toString());
      setGameStarted(true);
  };
  
  const handleBackToConfig = () => {
      setGameStarted(false);
      setHistory([]);
      setError(null);
      setSuggestedWord('');
      setCandidates([]);
  };

  if (!gameStarted) {
      return (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Start New Game</h2>
                <p className="text-gray-600">Configure the solver for your Wordle game.</p>
            </div>

            <div className="space-y-8">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Word Length</label>
                    <div className="flex items-center gap-4">
                        <input 
                            type="number" 
                            inputMode="numeric"
                            min="3" 
                            max="50" 
                            value={inputLength} 
                            onChange={(e) => setInputLength(e.target.value)}
                            onBlur={() => {
                                let val = parseInt(inputLength);
                                if (isNaN(val) || val < 3) val = 3;
                                if (val > 50) val = 50;
                                setInputLength(val.toString());
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            placeholder="5"
                        />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        Enter the number of letters in the word (3-50). Default is 5.
                    </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                        {isDictLoading ? (
                             <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        )}
                        <h4 className="font-semibold text-blue-900">
                            {isDictLoading ? "Loading Dictionary..." : "Dictionary Ready"}
                        </h4>
                    </div>
                    <p className="text-sm text-blue-800 ml-8">
                        {isDictLoading 
                            ? "Fetching 479k+ words..." 
                            : `Loaded ${allWords.length.toLocaleString()} words available for solving.`}
                    </p>
                </div>

                <button 
                    onClick={handleStartGame}
                    disabled={isDictLoading}
                    className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isDictLoading ? "Please Wait..." : "Start Solver"}
                    {!isDictLoading && (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
      <div className="mb-6 border-b pb-4 flex flex-wrap justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Solver Active</h2>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded border">Length: {length}</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded border">Source: {dictSource}</span>
            </div>
        </div>
        <button 
            onClick={handleBackToConfig}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Change Length
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input Area */}
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Suggested Guess</h3>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="ml-4 flex items-center text-blue-600 font-medium">Computing best guess...</p>
              </div>
            ) : suggestedWord ? (
              <div>
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {suggestedWord.split('').map((char, index) => (
                    <button
                      key={index}
                      onClick={() => handleFeedbackChange(index)}
                      className={clsx(
                        "font-bold uppercase rounded transition-colors shadow-sm select-none flex items-center justify-center",
                        length > 15 ? "w-8 h-10 text-sm" : "w-12 h-14 text-xl",
                        currentFeedback[index] === 'gray' && "bg-gray-400 text-white hover:bg-gray-500",
                        currentFeedback[index] === 'yellow' && "bg-yellow-500 text-white hover:bg-yellow-600",
                        currentFeedback[index] === 'green' && "bg-green-600 text-white hover:bg-green-700"
                      )}
                      title="Click to toggle color"
                    >
                      {char}
                    </button>
                  ))}
                </div>
                
                <div className="flex justify-center gap-4">
                    <button 
                        onClick={handleSubmit}
                        disabled={candidates.length <= 1 && history.length > 0 && history[history.length-1].word === suggestedWord}
                        className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50"
                    >
                        Update Solver
                    </button>
                </div>
                <p className="text-center text-sm text-gray-500 mt-4">
                  Click the letters to match the colors from your game.
                </p>
              </div>
            ) : (
               <div className="text-center py-8 text-gray-500">
                  {candidates.length === 0 ? "No words found." : "Thinking..."}
               </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
              {error}
              <button onClick={handleRestart} className="ml-4 underline font-bold">Restart</button>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
             <strong>Candidates Remaining:</strong> {candidates.length}
             {candidates.length < 20 && candidates.length > 0 && (
                 <div className="mt-2 text-xs text-blue-600 font-mono break-words">
                     {candidates.join(', ')}
                 </div>
             )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-fit max-h-[600px] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Guess History</h3>
            <button onClick={handleRestart} className="text-sm text-red-600 hover:text-red-800 underline">
                Reset
            </button>
          </div>
          
          {history.length === 0 ? (
            <p className="text-gray-400 italic text-center py-8">No guesses yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, i) => (
                <div key={i} className="flex flex-wrap gap-1 p-2 bg-white rounded shadow-sm">
                  {entry.word.split('').map((char, j) => (
                    <div
                      key={j}
                      className={clsx(
                        "flex items-center justify-center font-bold uppercase rounded text-white text-xs",
                        length > 15 ? "w-5 h-6" : "w-8 h-10",
                        entry.feedback[j] === 'gray' && "bg-gray-400",
                        entry.feedback[j] === 'yellow' && "bg-yellow-500",
                        entry.feedback[j] === 'green' && "bg-green-600"
                      )}
                    >
                      {char}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
