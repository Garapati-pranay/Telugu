import TranscriptionDemo from '@/components/TranscriptionDemo';

export default function WhisperDemoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-24">
      <div className="w-full max-w-2xl">
        {/* You can add a page title or other elements here if needed */}
        {/* <h1 className="text-2xl font-bold mb-6 text-center">Whisper API Demo</h1> */}

        <TranscriptionDemo />
      </div>
    </main>
  );
} 