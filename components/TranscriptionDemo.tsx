'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FaMicrophone, FaStop, FaSpinner } from 'react-icons/fa'; // Example icons

const TranscriptionDemo: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [transcription, setTranscription] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null); // State for playback URL

    // Refs for MediaRecorder and audio chunks
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Get the BASE API URL from environment variables
    const baseApiUrl = process.env.NEXT_PUBLIC_TRANSCRIPTION_API_URL;

    const handleStop = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const handleStartRecording = async () => {
        setError(null);
        setTranscription(null);
        // Clean up previous playback URL if it exists
        if (audioPlaybackUrl) {
            URL.revokeObjectURL(audioPlaybackUrl);
            setAudioPlaybackUrl(null);
        }

        if (!baseApiUrl) {
            setError("Base Transcription API URL is not configured. Please set NEXT_PUBLIC_TRANSCRIPTION_API_URL.");
            return;
        }

        if (isRecording) {
            handleStop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
            });

            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                setIsRecording(false);
                setIsLoading(true);
                setError(null);

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                // Create playback URL
                const playbackUrl = URL.createObjectURL(audioBlob);
                setAudioPlaybackUrl(playbackUrl);

                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');

                try {
                    // *** Ensure trailing slash here ***
                    const fullApiUrl = new URL('/transcribe/', baseApiUrl).toString(); 

                    console.log(`Sending audio to API: ${fullApiUrl}`);
                    const response = await fetch(fullApiUrl, {
                        method: 'POST',
                        body: formData,
                    });

                    const result = await response.json();

                    if (response.ok) {
                        setTranscription(result.transcription);
                        console.log('Transcription success:', result);
                    } else {
                        setError(`API Error: ${result.detail || response.statusText}`);
                        console.error('API Error:', result);
                    }
                } catch (err) {
                    console.error("Error sending audio to API:", err);
                    setError(`Network or fetch error: ${(err as Error).message}`);
                } finally {
                    setIsLoading(false);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

        } catch (err) {
            console.error("Error accessing microphone or starting recording:", err);
            setError(`Microphone Error: ${(err as Error).message}. Please ensure permission is granted.`);
            setIsRecording(false);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Stop recording if active
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            // Stop associated stream tracks
             if (mediaRecorderRef.current?.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
            // Revoke playback URL if it exists
            if (audioPlaybackUrl) {
                URL.revokeObjectURL(audioPlaybackUrl);
            }
        };
    }, [audioPlaybackUrl]);

    return (
        <div className="p-4 border rounded-lg shadow-md space-y-4 max-w-md mx-auto mt-10 bg-white">
            <h2 className="text-xl font-semibold text-center text-gray-700">Whisper API Transcription Demo</h2>

            {!baseApiUrl && (
                 <div className="text-red-600 bg-red-100 p-3 rounded text-center">
                    <strong>Configuration Error:</strong> Base <code>NEXT_PUBLIC_TRANSCRIPTION_API_URL</code> is not set.
                 </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={handleStartRecording}
                    disabled={isLoading || !baseApiUrl}
                    className={`px-6 py-3 rounded-full text-white font-medium flex items-center justify-center transition-colors duration-200 ease-in-out
                        ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}
                        ${isLoading || !baseApiUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? (
                        <FaSpinner className="animate-spin mr-2" />
                    ) : isRecording ? (
                        <FaStop className="mr-2" />
                    ) : (
                        <FaMicrophone className="mr-2" />
                    )}
                    {isLoading ? 'Processing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
            </div>

            {isRecording && (
                <p className="text-center text-yellow-600 animate-pulse">Recording in progress...</p>
            )}

            {/* Audio Playback Element */} 
            {audioPlaybackUrl && !isRecording && (
                <div className="mt-4">
                    <h3 className="font-semibold text-gray-700 mb-2 text-center">Recorded Audio:</h3>
                    <audio controls src={audioPlaybackUrl} className="w-full">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {error && (
                <div className="text-red-600 bg-red-100 p-3 rounded text-center">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {transcription && !error && (
                <div className="mt-4 p-3 bg-gray-100 rounded border border-gray-300">
                    <h3 className="font-semibold text-gray-700 mb-2">Transcription Result:</h3>
                    <p className="text-gray-800 whitespace-pre-wrap">{transcription}</p>
                </div>
            )}
        </div>
    );
};

export default TranscriptionDemo;
