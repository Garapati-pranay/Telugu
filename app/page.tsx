'use client';

import { useState, useEffect, useCallback } from 'react';
// Import Supabase client
import { supabase } from '@/lib/supabaseClient';
// Remove Firebase imports
// import { db, storage } from '@/lib/firebase';
// import { collection, query, where, orderBy, limit, onSnapshot, DocumentData, QueryDocumentSnapshot, addDoc, serverTimestamp, updateDoc, doc, getCountFromServer } from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import TranscriptInput from '@/components/TranscriptInput';
import Recorder from '@/components/Recorder';
import { ImSpinner2 } from 'react-icons/im'; // Import a spinner icon
// Add icons for review mode
import { FaRedoAlt, FaListUl, FaMicrophone } from 'react-icons/fa';

// Interface remains largely the same, but id is likely string (UUID)
// and created_at is string (ISO timestamp)
interface Transcript {
  id: string; // Supabase uses UUID strings by default
  transcript: string;
  audio_url: string | null;
  status: 'pending' | 'completed';
  created_at: string; // Supabase timestamp is typically string
}

type Mode = 'record' | 'review';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [transcriptsExist, setTranscriptsExist] = useState<boolean | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<Transcript | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // New States for Review/Re-record
  const [mode, setMode] = useState<Mode>('record'); // 'record' or 'review'
  const [reviewList, setReviewList] = useState<Transcript[]>([]); // List of completed items
  const [isFetchingReviewList, setIsFetchingReviewList] = useState<boolean>(false);
  const [transcriptToRerecord, setTranscriptToRerecord] = useState<Transcript | null>(null); // Item selected for re-recording

  const tableName = 'transcripts'; // Define table name once
  const bucketName = 'audio';     // Define bucket name once

  // --- Data Fetching Functions ---

  const fetchCounts = useCallback(async () => {
    try {
      // Fetch total count
      const { count: total, error: totalError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;
      setTotalCount(total ?? 0);

      // Fetch completed count
      const { count: completed, error: completedError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      if (completedError) throw completedError;
      setCompletedCount(completed ?? 0);

    } catch (err) {
       console.error("Error fetching counts:", err);
       setError(`Failed to fetch counts: ${(err as Error).message}`);
    }
  }, []);

  const fetchNextPendingTranscript = useCallback(async () => {
    // No need to setIsLoading here, handled by listener/initial load
    setError(null);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(); // Returns single object or null

      if (error) throw error;

      setCurrentTranscript(data as Transcript | null);
      // setIsLoading(false); // Loading finished after fetch

    } catch (err) {
      console.error("Error fetching pending transcript:", err);
      setError(`Failed to fetch next transcript: ${(err as Error).message}`);
      setCurrentTranscript(null); // Clear transcript on error
      // setIsLoading(false);
    }
  }, []);

  // New: Fetch completed transcripts for review
  const fetchCompletedTranscripts = useCallback(async () => {
      setIsFetchingReviewList(true);
      setError(null);
      try {
          const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .eq('status', 'completed')
              .order('created_at', { ascending: false }); // Show newest completed first

          if (error) throw error;
          setReviewList((data as Transcript[]) ?? []);
      } catch (err) {
          console.error("Error fetching completed transcripts:", err);
          setError(`Failed to fetch review list: ${(err as Error).message}`);
          setReviewList([]);
      } finally {
          setIsFetchingReviewList(false);
      }
  }, []);

  // --- Effects ---

  // 1. Check if transcripts exist on initial load
  useEffect(() => {
    const checkExistence = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error) throw error;
        const exists = (count ?? 0) > 0;
        setTranscriptsExist(exists);
        if (!exists) {
             setMode('record'); // Default to record mode if nothing exists
        }
      } catch (err) {
        console.error("Error checking transcript existence:", err);
        setError(`Failed to check for transcripts: ${(err as Error).message}`);
        setTranscriptsExist(false); // Assume none exist on error
      } finally {
        setIsLoading(false);
      }
    };
    checkExistence();
  }, []); // Run only once on mount

  // 2. Fetch initial data and set up listener if transcripts exist
  useEffect(() => {
    if (transcriptsExist === true) {
        setIsLoading(true);
        // Fetch initial counts and the first transcript
        Promise.all([fetchCounts(), fetchNextPendingTranscript()]).finally(() => {
            setIsLoading(false);
        });

        // Set up Supabase Realtime subscription
        const channel = supabase.channel('public:transcripts')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: tableName },
                (payload) => {
                    console.log('Change received!', payload);
                    // Refetch counts and next transcript on any change
                    // Simple approach: refetch everything relevant
                    // More complex: inspect payload to be more efficient
                    fetchCounts();
                    fetchNextPendingTranscript();

                    // If in review mode and a change happens, refetch the review list
                    // Check the current mode using a state accessor function if needed,
                    // or simply always refetch if the cost is low.
                    // For simplicity, we can fetch it when switching modes or manually.
                    // Let's add a check: if mode is review, fetch review list
                    setMode(currentMode => {
                        if (currentMode === 'review') {
                            fetchCompletedTranscripts(); // Refetch review list if viewing it
                        }
                        return currentMode; // Keep mode the same
                    });

                     // If the item being re-recorded was updated, clear it
                     if (payload.eventType === 'UPDATE' && payload.new?.id === transcriptToRerecord?.id) {
                         // Check if status changed or audio_url changed significantly
                         setTranscriptToRerecord(null); // Assume re-record done, clear state
                         setMode('review'); // Optionally switch back to review mode
                     }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('Realtime channel subscribed');
                 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Realtime subscription error:', status, err);
                    setError('Realtime connection failed. Please refresh.');
                 }
            });

        // Cleanup listener on component unmount or when transcriptsExist changes
        return () => {
            supabase.removeChannel(channel);
            console.log('Realtime channel unsubscribed');
        };
    }
    // Dependencies: transcriptsExist triggers setup, fetch functions are memoized
  }, [transcriptsExist, fetchCounts, fetchNextPendingTranscript, fetchCompletedTranscripts, transcriptToRerecord?.id]); // Added fetchCompletedTranscripts to dependency

  // --- Handler Functions ---

  const handleTranscriptsSubmitted = () => {
    setTranscriptsExist(true);
    // Optionally switch back to record mode if user was in review mode
    setMode('record');
    setTranscriptToRerecord(null); // Clear any pending re-record
  };

  const handleRecordingConfirm = async (blob: Blob | null, transcriptId: string) => {
    const isRerecord = transcriptToRerecord?.id === transcriptId;
    const targetTranscript = transcriptToRerecord ?? currentTranscript; // Determine which transcript we're confirming

    if (!blob || !transcriptId) {
      setError("Recording data is missing.");
      return;
    }
    if (!targetTranscript || targetTranscript.id !== transcriptId) {
        setError("Transcript ID mismatch.");
        return;
    }

    setIsUploading(true);
    setError(null);
    const filePath = `${bucketName}/${transcriptId}.webm`;

    try {
      // 1. Upload (upsert handles overwriting for re-records)
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, blob, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      if (!urlData || !urlData.publicUrl) throw new Error("Could not get public URL after upload.");
      const downloadURL = urlData.publicUrl;

      // 3. Update Database (Mark as completed, even if it was already)
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ audio_url: downloadURL, status: 'completed' }) // Ensure status is 'completed'
        .eq('id', transcriptId);
      if (updateError) throw updateError;

      console.log(`Transcript ${transcriptId} ${isRerecord ? 're-recorded' : 'completed'}! URL: ${downloadURL}`);

      // Clear re-record state and potentially switch mode
      if (isRerecord) {
          setTranscriptToRerecord(null);
          // Option 1: Stay in record mode (if there are pending items)
          // Option 2: Switch back to review mode automatically
          setMode('review'); // Let's switch back to review mode
          fetchCompletedTranscripts(); // Refetch review list immediately
      }
      // For normal records, the realtime listener handles fetching the next pending one.

    } catch (err) {
      console.error("Error confirming recording:", err);
      setError(`Failed to save recording: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // New: Handle starting a re-record
  const handleStartRerecord = (transcript: Transcript) => {
      setTranscriptToRerecord(transcript);
      setCurrentTranscript(null); // Ensure we don't show pending transcript
      setMode('record'); // Switch mode to show the recorder interface
      setError(null); // Clear previous errors
  };

  // New: Handle mode switching
  const switchToRecordMode = () => {
      setMode('record');
      setTranscriptToRerecord(null); // Clear re-record state
      setError(null);
      // Optional: Re-fetch pending if needed, though listener should handle it
      // fetchNextPendingTranscript();
  };

  const switchToReviewMode = () => {
      setMode('review');
      setTranscriptToRerecord(null); // Clear re-record state
      setError(null);
      fetchCompletedTranscripts(); // Fetch the list when switching
  };

  // --- Render Logic (Remains the same as before) ---

  if (isLoading && transcriptsExist === null) {
    return (
        <div className="flex items-center justify-center min-h-screen text-gray-500">
            <ImSpinner2 className="animate-spin h-8 w-8 mr-3" />
            Loading...
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-red-600 dark:text-red-400 p-4">
            <h2 className="text-xl font-semibold mb-2">Oops! Something went wrong.</h2>
            <p className="text-center">{error}</p>
            {/* Optional: Add a refresh button */}
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
                Refresh Page
            </button>
        </div>
    );
  }

  // Display active transcript (either pending or the one being re-recorded)
  const activeTranscriptForRecording = transcriptToRerecord ?? currentTranscript;

  return (
    <main className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-gray-800 dark:text-gray-200">Speak Casually</h1>

      {/* Mode Switch Buttons (only show if transcripts exist) */}
       {transcriptsExist && (
           <div className="flex gap-4 mb-6">
               <button
                   onClick={switchToRecordMode}
                   disabled={mode === 'record' && !transcriptToRerecord} // Disable if already recording pending
                   className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'record' && !transcriptToRerecord ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
               >
                   <FaMicrophone /> Record Pending
               </button>
               <button
                   onClick={switchToReviewMode}
                   disabled={mode === 'review' || transcriptToRerecord !== null} // Disable if reviewing or during re-record
                   className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'review' && !transcriptToRerecord ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
               >
                   <FaListUl /> Review Completed ({completedCount})
               </button>
           </div>
       )}

      {/* --- Conditional Content Area --- */}
      <div className="w-full max-w-lg">
          {/* Uploading Overlay */}
          {isUploading && (
             <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50">
               <ImSpinner2 className="animate-spin h-10 w-10 text-white mb-3" />
               <p className="text-white text-lg">Uploading Recording...</p>
             </div>
          )}

          {/* Initial Transcript Input */}
          {transcriptsExist === false && !isLoading && (
              <TranscriptInput
                  onSubmitted={handleTranscriptsSubmitted}
                  transcriptsExist={transcriptsExist}
              />
          )}

          {/* Recording Mode */}
          {transcriptsExist === true && (mode === 'record' || transcriptToRerecord !== null) && (
               <>
                   {isLoading && !activeTranscriptForRecording ? (
                       <div className="flex items-center justify-center p-10 text-gray-500"><ImSpinner2 className="animate-spin h-6 w-6 mr-2" />Loading transcript...</div>
                   ) : activeTranscriptForRecording ? (
                       <>
                           <div className="mb-6 text-center">
                               <p className="text-base text-gray-600 dark:text-gray-400">
                                   {transcriptToRerecord ? 'Re-recording' : `Recording ${completedCount + 1} of ${totalCount}`}
                               </p>
                               <p className="text-xl md:text-2xl font-semibold mt-3 bg-white dark:bg-gray-700 shadow p-4 rounded-lg text-gray-900 dark:text-gray-100 font-mono">
                                   {activeTranscriptForRecording.transcript}
                               </p>
                           </div>
                           <Recorder
                               transcript={activeTranscriptForRecording} // Pass the correct transcript
                               onConfirm={handleRecordingConfirm}
                               isUploading={isUploading}
                           />
                           {/* Button to cancel re-record */}
                            {transcriptToRerecord && (
                                <button
                                    onClick={switchToReviewMode} // Go back to review list
                                    className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:underline"
                                    disabled={isUploading}
                                >
                                    Cancel Re-record
                                </button>
                            )}
                       </>
                   ) : (
                       // No pending items left, show "All Done" but allow mode switch
                       <div className="text-center p-8 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg shadow-md">
                           <h2 className="text-2xl font-semibold text-green-800 dark:text-green-200">🎉 All Pending Done! 🎉</h2>
                           <p className="text-green-700 dark:text-green-300 mt-3">You have completed recording all {totalCount} initial transcripts.</p>
                           <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">You can now review completed recordings or add more transcripts.</p>
                            {/* Button to Add More */}
                            <button
                                onClick={() => setTranscriptsExist(false)} // Hacky way to show input again? Or better: add dedicated "Add More" button/mode
                                className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                             >
                                Add More Transcripts
                            </button>
                       </div>
                   )}
               </>
          )}

          {/* Review Mode */}
          {transcriptsExist === true && mode === 'review' && !transcriptToRerecord && (
               <div className="mt-4">
                   <h2 className="text-xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">Review Completed Recordings ({reviewList.length})</h2>
                   {isFetchingReviewList ? (
                       <div className="flex items-center justify-center p-10 text-gray-500"><ImSpinner2 className="animate-spin h-6 w-6 mr-2" />Loading review list...</div>
                   ) : reviewList.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">No recordings completed yet.</p>
                   ) : (
                       <ul className="space-y-4">
                           {reviewList.map((item) => (
                               <li key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                                   <p className="text-gray-800 dark:text-gray-200 mb-3 font-mono">{item.transcript}</p>
                                   <div className="flex flex-col sm:flex-row items-center gap-4">
                                       {item.audio_url ? (
                                           <audio src={item.audio_url} controls className="w-full sm:w-auto flex-grow rounded-md shadow-sm h-10"></audio>
                                       ) : (
                                           <p className="text-sm text-gray-400 flex-grow">Audio not found</p>
                                       )}
                                       <button
                                           onClick={() => handleStartRerecord(item)}
                                           disabled={isUploading}
                                           className="flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-1.5 text-sm font-medium rounded-md border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                       >
                                           <FaRedoAlt /> Re-record
                                       </button>
                                   </div>
                               </li>
                           ))}
                       </ul>
                   )}
                    {/* Add More Transcripts Button (also in review mode) */}
                    <div className="mt-6 text-center">
                         <button
                             onClick={() => setTranscriptsExist(false)} // Temporary way to show input
                             className="px-5 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-sm font-medium"
                         >
                             Add More Transcripts
                         </button>
                    </div>
               </div>
          )}

          {/* Fallback if something unexpected happens */}
           {transcriptsExist === true && !isLoading && !activeTranscriptForRecording && mode === 'record' && !transcriptToRerecord && (
               <p className="text-center text-gray-500 mt-10">Loading or state issue...</p>
           )}

      </div>
    </main>
  );
}
