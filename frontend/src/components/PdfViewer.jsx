import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Spin, Alert } from 'antd';

// Use Vite's ?url import to get the worker file path
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const PdfViewer = ({ url, scale = 1.2, extractedBlocks = [], ocrPageSizes = {}, onInitScale, enableDragPan = false }) => {
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPdf(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDocument = await loadingTask.promise;
        if (active) {
          setPdf(pdfDocument);
          if (scale === 0 && onInitScale && containerRef.current) {
             const page1 = await pdfDocument.getPage(1);
             const vw = page1.getViewport({ scale: 1.0 });
             const cw = containerRef.current.clientWidth;
             onInitScale((cw - 20) / vw.width); // Subtract buffer for scrollbars
          }
        }
      } catch (err) {
        if (active) {
          console.error('Error loading PDF:', err);
          setError(err.message || '文档加载失败');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (url) {
      loadPdf();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
      if (pdf) {
        pdf.destroy().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!enableDragPan || !isPanning) return undefined;
    const handleMove = (e) => {
      if (!containerRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panStartRef.current.left - dx;
      containerRef.current.scrollTop = panStartRef.current.top - dy;
    };
    const handleUp = () => setIsPanning(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [enableDragPan, isPanning]);

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        if (!enableDragPan || e.button !== 0 || !containerRef.current) return;
        e.preventDefault();
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          left: containerRef.current.scrollLeft,
          top: containerRef.current.scrollTop,
        };
        setIsPanning(true);
      }}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'auto',
        background: '#e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        boxSizing: 'border-box',
        position: 'relative',
        cursor: enableDragPan ? (isPanning ? 'grabbing' : 'grab') : 'default',
        userSelect: enableDragPan ? 'none' : 'auto',
      }}
    >
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Spin tip="正在解析 PDF..." size="large" />
        </div>
      )}
      {error && (
        <div style={{ padding: 24, width: '100%', maxWidth: 600 }}>
          <Alert message="PDF 渲染失败" description={error} type="error" showIcon />
        </div>
      )}
      {pdf && Array.from({ length: pdf.numPages }).map((_, index) => (
        <PdfPage 
          key={index} 
          pageNum={index + 1} 
          pdf={pdf} 
          scale={scale === 0 ? 1.0 : scale} 
          extractedBlocks={extractedBlocks} 
          ocrWidth={ocrPageSizes[String(index + 1)]?.w}
        />
      ))}
    </div>
  );
};

const PdfPage = ({ pageNum, pdf, scale, extractedBlocks, ocrWidth }) => {
  const canvasRef = useRef(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [baseWidth, setBaseWidth] = useState(0);

  useEffect(() => {
    let active = true;
    let renderTask = null;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (!active) return;
        
        const viewport = page.getViewport({ scale });
        const baseViewport = page.getViewport({ scale: 1.0 });
        if (active) setBaseWidth(baseViewport.width);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        
        // Handle high DPI displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height =  Math.floor(viewport.height) + "px";

        const transform = outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : null;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport,
        };
        
        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        if (active) setPageLoading(false);
      } catch (err) {
        if (active && err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
          setPageLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pageNum, pdf, scale]);

  return (
    <div
      style={{
        marginBottom: 24,
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        minHeight: 400,
        minWidth: 300,
      }}
    >
      {pageLoading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Spin />
        </div>
      )}
      <canvas ref={canvasRef} />
      {extractedBlocks && baseWidth > 0 && extractedBlocks.map((b, bi) => {
        if (!b.bbox) return null;
        const blockPage = b.page_no || 1;
        if (blockPage !== pageNum) return null;
        
        // Dynamic OCR Resolution Compensation
        const dScale = ocrWidth ? (baseWidth * scale / ocrWidth) : scale;
        
        return (
          <div key={bi} style={{
            position: 'absolute',
            left: b.bbox.x * dScale,
            top: b.bbox.y * dScale,
            width: b.bbox.w * dScale,
            height: b.bbox.h * dScale,
            border: '2px solid rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            pointerEvents: 'none',
          }} />
        );
      })}
    </div>
  );
};

export default PdfViewer;
