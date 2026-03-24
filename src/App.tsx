
import { WordleSolver } from './components/WordleSolver';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">
              <span className="text-green-600">Wordle</span> Solver
            </h1>
          </div>
          <a href="https://github.com/dwyl/english-words" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-700">
            Dictionary Source
          </a>
        </div>
      </header>
      
      <main className="flex-grow py-8 px-4">
        <WordleSolver />
      </main>
      
      <footer className="py-6 text-center text-gray-400 text-sm">
        <p>Optimal strategy using Information Theory (Entropy) & Frequency Analysis</p>
      </footer>
    </div>
  );
}

export default App;
