'use client';

import { useState } from 'react';
// Import Supabase client
import { supabase } from '@/lib/supabaseClient';
// Remove Firestore imports
// import { db } from '@/lib/firebase';
// import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { FaPaperPlane } from 'react-icons/fa'; // Import send icon
import { ImSpinner2 } from 'react-icons/im'; // Import spinner

interface TranscriptInputProps {
  onSubmitted: () => void;
  transcriptsExist: boolean | null; // Add prop to know if transcripts already exist
}

const TranscriptInput: React.FC<TranscriptInputProps> = ({ onSubmitted, transcriptsExist }) => {
  const [transcriptList, setTranscriptList] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptList.trim()) {
      setError('Transcript list cannot be empty.');
      return;
    }

    const lines = transcriptList.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
      setError('No valid transcript lines found.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Prepare data for Supabase insert
    const transcriptsToInsert = lines.map(line => ({
      transcript: line,
      // Supabase handles id and created_at automatically if table is set up correctly
      // status defaults to 'pending' based on table definition
      // audio_url defaults to null based on table definition
    }));

    try {
      // Use Supabase bulk insert
      const { error: insertError } = await supabase
        .from('transcripts') // Make sure your table name is 'transcripts'
        .insert(transcriptsToInsert);

      if (insertError) {
        throw insertError;
      }

      console.log(`Successfully added ${lines.length} transcripts.`);
      setTranscriptList(''); // Clear textarea
      onSubmitted(); // Notify parent component
    } catch (err) {
      console.error("Error adding transcripts:", err);
      setError(`Failed to submit transcripts: ${(err as Error).message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get line count for button label
  const lineCount = transcriptList.trim() ? transcriptList.trim().split('\n').filter(l => l.trim()).length : 0;

  const buttonText = transcriptsExist ? `Add ${lineCount} More Transcript${lineCount !== 1 ? 's' : ''}` : `Submit ${lineCount} Transcript${lineCount !== 1 ? 's' : ''}`;

  return (
    <div className="w-full max-w-lg p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
        {transcriptsExist ? 'Add More Transcripts' : 'Paste Initial Transcripts'}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
        Paste your Romanized Telugu transcripts below, one per line. Each line will become a recording task.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
          value={transcriptList}
          onChange={(e) => setTranscriptList(e.target.value)}
          placeholder="Example:
nelavanka thongi choosindi
nallamabbu challaga navvindi
akasamlo taaralu kammukunnavi"
          required
          disabled={isSubmitting}
        />
        {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4 font-medium">Error: {error}</p>}
        <button
          type="submit"
          className={`w-full flex items-center justify-center px-6 py-3 text-lg text-white font-semibold rounded-md transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 ${isSubmitting || lineCount === 0 ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          disabled={isSubmitting || lineCount === 0}
        >
          {isSubmitting ? (
            <ImSpinner2 className="animate-spin h-5 w-5 mr-2" />
          ) : (
            <FaPaperPlane className="h-5 w-5 mr-2" />
          )}
          {isSubmitting ? 'Submitting...' : buttonText}
        </button>
      </form>
    </div>
  );
};

export default TranscriptInput; 