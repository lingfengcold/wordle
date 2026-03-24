import _ from 'lodash';
import commonWordsList from '../assets/common-words.json';

const commonWordsSet = new Set(commonWordsList);

// Best starting words for common lengths to save computation time
// Optimized for "Singular/Prototype" preference where possible
const STARTING_WORDS: Record<number, string> = {
  3: 'eat',
  4: 'near',
  5: 'arise', // standard, 3 vowels
  6: 'orient', 
  7: 'staring',
  8: 'creation',
  9: 'inflation',
  10: 'projection',
  11: 'information',
  12: 'relationship',
  13: 'communication',
  14: 'administration',
  15: 'congratulations'
};

// Feedback types
export type FeedbackColor = 'gray' | 'yellow' | 'green';
export type Feedback = FeedbackColor[];

export interface GuessResult {
  word: string;
  feedback: Feedback;
}

// Get feedback for a guess against a target answer (for simulation)
export function getFeedback(guess: string, answer: string): Feedback {
  const len = guess.length;
  const feedback: Feedback = Array(len).fill('gray');
  const answerArr = answer.split('');
  const guessArr = guess.split('');

  // 1. Mark Greens
  for (let i = 0; i < len; i++) {
    if (guessArr[i] === answerArr[i]) {
      feedback[i] = 'green';
      answerArr[i] = '#'; // Mark as used
      guessArr[i] = '_'; // Mark as processed
    }
  }

  // 2. Mark Yellows
  for (let i = 0; i < len; i++) {
    if (feedback[i] === 'green') continue;
    
    const char = guessArr[i];
    const indexInAnswer = answerArr.indexOf(char);
    
    if (indexInAnswer !== -1) {
      feedback[i] = 'yellow';
      answerArr[indexInAnswer] = '#'; // Mark as used
    }
  }

  return feedback;
}

// Filter candidates based on previous guess and feedback
export function filterCandidates(candidates: string[], guess: string, feedback: Feedback): string[] {
  // Use simulation to filter.
  // A candidate is valid if getFeedback(guess, candidate) == feedback.
  // This correctly handles all edge cases (double letters, etc.)
  return candidates.filter(candidate => {
    const simulatedFeedback = getFeedback(guess, candidate);
    return _.isEqual(simulatedFeedback, feedback);
  });
}

// Calculate Entropy of a guess given a set of candidates
// H = - Sum (p * log2(p))
function calculateEntropy(guess: string, candidates: string[]): number {
  const counts: Record<string, number> = {};
  const total = candidates.length;
  
  // Optimization: If candidates is huge, sample them for entropy calc?
  // But usually this function is called when candidates are relatively small.
  // If we have 2000 candidates, 2000 getFeedback calls is fast.
  
  for (const candidate of candidates) {
    const feedback = getFeedback(guess, candidate);
    // Use a string key for the map
    const key = feedback.join(',');
    counts[key] = (counts[key] || 0) + 1;
  }

  let entropy = 0;
  for (const key in counts) {
    const p = counts[key] / total;
    if (p > 0) {
        entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

// Heuristic: Maximize positional frequency + unique letters
// Faster than entropy for large sets
function calculateFrequencyScore(guess: string, candidates: string[]): number {
    // Build frequency map of candidates
    const posFreq: Record<number, Record<string, number>> = {};
    
    for (let i=0; i<guess.length; i++) posFreq[i] = {};

    for (const word of candidates) {
        for (let i=0; i<word.length; i++) {
            const char = word[i];
            posFreq[i][char] = (posFreq[i][char] || 0) + 1;
        }
    }

    let score = 0;
    const seen = new Set<string>();
    
    for (let i=0; i<guess.length; i++) {
        const char = guess[i];
        // Reward high probability at this position
        score += (posFreq[i][char] || 0);
        
        // Reward covering a common letter (even if wrong spot) - only once per letter
        if (!seen.has(char)) {
             // Sum of frequencies of this char across all positions
             let globalFreq = 0;
             for(let j=0; j<guess.length; j++) globalFreq += (posFreq[j][char] || 0);
             score += globalFreq * 0.5; // Weight global frequency
             seen.add(char);
        }
    }

    // Boost common words
    if (commonWordsSet.has(guess)) {
        score += candidates.length * 2.0; // Significant boost
    }

    return score;
}

export function getBestGuess(candidates: string[], allWords: string[]): string {
  if (candidates.length === 0) return '';
  
  // Optimization: If it's the first turn (full dictionary), use pre-calculated best guess
  const wordLen = candidates[0].length;
  const startWord = STARTING_WORDS[wordLen];
  if (candidates.length === allWords.length && startWord && candidates.includes(startWord)) {
      return startWord;
  }

  if (candidates.length === 1) return candidates[0];

  const useEntropy = candidates.length <= 200;

  // If we have very few candidates, we might want to search the broader dictionary for a "splitter"
  if (candidates.length <= 2) {
      return candidates[0];
  }

  if (useEntropy) {
      // If we have < 200 candidates, try to find the best splitter from candidates AND a subset of allWords.
      // Searching allWords is better but slower. Let's add top 500 from allWords if candidates is small.
      let searchSpace = candidates;
      if (allWords.length > 0 && candidates.length < 50) {
          // Add random sample of 500 words from dictionary to find splitters
          // We use sampleSize because the dictionary might be alphabetical (poor splitters at the start)
          const extra = _.sampleSize(allWords, 500);
          searchSpace = _.uniq([...candidates, ...extra]);
      }
      
      let bestWord = candidates[0];
      let maxEntropy = -1;

      // Limit entropy calc to prevent browser freeze. 
      // 500 words * 50 candidates = 25,000 checks. Fast.
      // 500 words * 200 candidates = 100,000 checks. Fast (< 100ms).
      
      for (const word of searchSpace) {
          const entropy = calculateEntropy(word, candidates);
          // Prefer words in candidates if entropy is equal (hard mode preference / chance to win)
          const isCandidate = candidates.includes(word);
          const isCommon = commonWordsSet.has(word);
          
          // Add biases:
          // 1. Candidate preference: Small (0.0001) - mainly tie-breaker
          // 2. Common word preference: Medium (0.5) - prioritize normal words if entropy is comparable
          // Note: Max entropy is usually around 5-10 bits. 0.5 bits is significant.
          const adjustedEntropy = entropy + (isCandidate ? 0.0001 : 0) + (isCommon ? 0.5 : 0);
          
          if (adjustedEntropy > maxEntropy) {
              maxEntropy = adjustedEntropy;
              bestWord = word;
          }
      }
      return bestWord;
  } else {
      // Use Frequency Heuristic
      let bestWord = candidates[0];
      let maxScore = -1;
      
      // Check a sample if too large
      const wordsToCheck = candidates.length > 2000 ? _.sampleSize(candidates, 2000) : candidates;

      for (const word of wordsToCheck) {
          const score = calculateFrequencyScore(word, candidates);
          if (score > maxScore) {
              maxScore = score;
              bestWord = word;
          }
      }
      return bestWord;
  }
}
