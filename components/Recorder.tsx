'use client';

import { useState, useRef, useEffect } from 'react';
import {
    FaMicrophone, FaStop, FaPlay, FaRedoAlt, FaCheck, FaExclamationTriangle
} from 'react-icons/fa'; // Import relevant icons

interface Transcript {
    id: string;
    transcript: string;
    // Add other fields if needed by Recorder, though likely not
}

interface RecorderProps {
    transcript: Transcript;
    onConfirm: (blob: Blob | null, transcriptId: string) => void;
    isUploading: boolean; // To disable buttons during upload
}

const Recorder: React.FC<RecorderProps> = ({ transcript, onConfirm, isUploading }) => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement>(null); // For playback

    // Request permission on component mount or when transcript changes
    useEffect(() => {
        getMicPermission();
        // Reset state if the transcript changes (e.g., after confirmation)
        resetState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcript.id]); // Rerun permission check/reset if transcript ID changes

    // Clean up audio URL when component unmounts or blob changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const getMicPermission = async () => {
        setError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Media Devices API not supported in this browser.");
            setPermissionGranted(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setPermissionGranted(true);
            // We don't need to keep the stream active here, just check permission
            // Stop tracks immediately to release the mic indicator
            stream.getTracks().forEach(track => track.stop());
        } catch (err: any) {
            console.error("Permission denied:", err);
            setError("Microphone permission denied. Please allow access in your browser settings.");
            setPermissionGranted(false);
        }
    };

    const resetState = () => {
        setIsRecording(false);
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        audioChunks.current = [];
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
        }
        mediaRecorder.current = null;
         // Don't reset permissionGranted or error related to permission
    };

    const startRecording = async () => {
        if (permissionGranted === null || !permissionGranted) {
            await getMicPermission();
             // Re-check permission after trying to get it
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { /* Already handled */ return; }
            try {
                 // Quick check again without creating stream if possible
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (!devices.some(device => device.kind === 'audioinput')) {
                    throw new Error("No audio input device found.");
                }
                 // If still no permission, the error state should be set from getMicPermission
                if (permissionGranted === false) return;
            } catch (err:any) {
                setError("Microphone access is required to start recording.");
                setPermissionGranted(false);
                 return;
            }
        }

        resetState();
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorder.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                audioChunks.current = [];
                stream.getTracks().forEach(track => track.stop());
            };

             recorder.onerror = (event: Event) => {
                console.error("MediaRecorder error:", event);
                setError("An error occurred during recording.");
                resetState();
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error("Error starting recording:", err);
            setError(`Could not start recording: ${err.message}`);
            resetState();
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();
            setIsRecording(false);
            // onstop handles blob creation and URL generation
        }
    };

    const handleRedo = () => {
        resetState();
    };

    const handleConfirm = () => {
        if (audioBlob && transcript) {
            onConfirm(audioBlob, transcript.id);
            // State reset happens via useEffect when transcript.id changes
        }
    };

    // --- Render Logic ---

    if (permissionGranted === false) {
        return (
            <div className="mt-6 p-6 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 rounded-lg text-center shadow-md">
                <FaExclamationTriangle className="text-red-500 dark:text-red-400 text-3xl mx-auto mb-3" />
                <p className="text-red-700 dark:text-red-300 font-semibold mb-1">Microphone Access Denied</p>
                <p className="text-red-600 dark:text-red-400 text-sm">
                    {error || "Please grant microphone permission in your browser settings to record audio."}
                </p>
                <button
                    onClick={getMicPermission}
                    className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-150 ease-in-out"
                >
                    Retry Permission
                </button>
            </div>
        );
    }
     if (permissionGranted === null) {
         // Still checking permission or waiting for user action
         return (
            <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 mt-6 p-6 h-40 border rounded-lg shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                Checking microphone access...
            </div>
         );
     }

    return (
        <div className="mt-6 p-6 border rounded-lg shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex flex-col items-center">
            {error && permissionGranted && (
                <p className="text-red-500 dark:text-red-400 text-sm mb-4 text-center font-medium">
                    <FaExclamationTriangle className="inline h-4 w-4 mr-1 mb-px" /> Error: {error}
                 </p>
            )}

            {/* Recording Button Section */}
            <div className="mb-6">
                {!isRecording && !audioBlob && (
                     // Big Record Button
                    <button
                        onClick={startRecording}
                        disabled={isUploading}
                        className={`w-20 h-20 flex items-center justify-center rounded-full text-white font-semibold text-lg shadow-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 ${isUploading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                        aria-label="Start Recording"
                    >
                        <FaMicrophone className="h-8 w-8" />
                    </button>
                )}
                {isRecording && (
                    // Big Stop Button (pulsing animation)
                    <button
                        onClick={stopRecording}
                        disabled={isUploading}
                        className={`w-20 h-20 flex items-center justify-center rounded-full text-white font-semibold text-lg shadow-lg transition-colors duration-150 ease-in-out animate-pulse focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 ${isUploading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        aria-label="Stop Recording"
                    >
                        <FaStop className="h-8 w-8" />
                    </button>
                )}
            </div>

            {/* Post-Recording Section */}
            {audioUrl && audioBlob && (
                <div className="w-full flex flex-col items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">Preview Recording</p>
                    {/* Responsive Audio Player */}
                    <audio ref={audioRef} src={audioUrl} controls className="w-full max-w-sm mb-5 rounded-md shadow-sm" />
                    {/* Action Buttons - flex layout for mobile */}
                    <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-sm">
                        {/* Redo Button */}
                        <button
                            onClick={handleRedo}
                            disabled={isUploading}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-label="Redo Recording"
                        >
                            <FaRedoAlt className="h-4 w-4" />
                            Redo
                        </button>
                        {/* Confirm Button */}
                        <button
                            onClick={handleConfirm}
                            disabled={isUploading}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium rounded-md text-white transition-colors duration-150 ease-in-out ${isUploading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                            aria-label="Confirm Recording"
                        >
                            <FaCheck className="h-4 w-4" />
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recorder; 