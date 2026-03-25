import React from 'react';

interface ImagePreviewProps {
  imageDataUrl: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imageDataUrl }) => {
  const downloadImage = () => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = 'brand-image.png';
    a.click();
  };

  return (
    <div className="mt-4 p-4 border border-slate-700 rounded-lg bg-slate-800/30">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-teal-300">Generated Image</h3>
        <button
          onClick={downloadImage}
          className="text-xs text-slate-400 hover:text-teal-400"
        >
          Download
        </button>
      </div>
      <img src={imageDataUrl} alt="Generated brand image" className="max-w-full h-auto rounded" />
    </div>
  );
};

export default ImagePreview;
