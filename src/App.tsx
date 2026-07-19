import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Download,
  Search,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink,
  Code,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Heart,
  X,
  Play,
  Pause,
  FileText,
  FolderOpen,
  FileArchive,
  CheckSquare,
  Square,
  Volume2,
  VolumeX,
  FileCode,
  Sparkles,
  HelpCircle,
  Eye,
  ChevronRight,
  SlidersHorizontal,
  Clipboard,
  Check,
  Globe,
  ArrowLeft,
  History
} from 'lucide-react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';

// Interface for media files
interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'other';
  size: string;
  thumbnailUrl?: string;
  isResolved?: boolean;
}

// Interface for saved albums
interface SavedAlbum {
  id: string;
  title: string;
  sourceUrl?: string;
  itemsCount: number;
  items: MediaItem[];
  savedAt: string;
}

// Helper to rewrite old or dead Bunkr domains to the active working domain (bunkr.cr)
const rewriteBunkrUrl = (urlStr: string): string => {
  if (!urlStr) return '';
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }
  try {
    const urlObj = new URL(trimmed);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Rewrite bunkr domains to .cr
    if (hostname.includes('bunkr') && !hostname.endsWith('.cr')) {
      let newHostname = hostname;
      if (hostname.includes('bunkr-albums.io')) {
        newHostname = hostname.replace('bunkr-albums.io', 'bunkr.cr');
      } else {
        newHostname = hostname.replace(/bunkr\.[a-z0-9]{2,6}/g, 'bunkr.cr');
      }
      urlObj.hostname = newHostname;
      return urlObj.toString();
    }

    // Rewrite media-files domains to .cr
    if (hostname.includes('media-files') && !hostname.endsWith('.cr')) {
      urlObj.hostname = hostname.replace(/media-files\.[a-z0-9]{2,6}/g, 'media-files.cr');
      return urlObj.toString();
    }
  } catch (e) {
    // Return original if parsing fails
  }
  return trimmed;
};

export default function App() {
  // Navigation View Mode: 'search' (balbums.st portal) | 'viewer' (album files page)
  const [viewMode, setViewMode] = useState<'search' | 'viewer'>('search');

  // Search Engine states for the balbums.st portal replica
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIsLoading, setSearchIsLoading] = useState(false);
  const [trendingAlbums, setTrendingAlbums] = useState<any[]>([]);

  // Tabs within the Import panel: 'url' | 'html' | 'saved' | 'help' | 'bookmarklet' | 'webview' | 'history'
  const [activeTab, setActiveTab] = useState<'url' | 'html' | 'saved' | 'help' | 'bookmarklet' | 'webview' | 'history'>('url');

  // Download History
  const [downloadHistory, setDownloadHistory] = useState<(MediaItem & { downloadedAt: Date })[]>([]);

  // Input states
  const [inputUrl, setInputUrl] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [clipboardStatus, setClipboardStatus] = useState<'idle' | 'success' | 'empty' | 'error'>('idle');
  const [customAlbumTitle, setCustomAlbumTitle] = useState('');

  // Integrated Same-Origin Webview Scraper States
  const [webviewInputUrl, setWebviewInputUrl] = useState('https://bunkr.cr');
  const [activeWebviewUrl, setActiveWebviewUrl] = useState('');
  const [webviewMediaItems, setWebviewMediaItems] = useState<MediaItem[]>([]);
  const [webviewAlbumTitle, setWebviewAlbumTitle] = useState('');
  const [isWebviewLoading, setIsWebviewLoading] = useState(false);

  // Album Data
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumSourceUrl, setAlbumSourceUrl] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cloudflareBlock, setCloudflareBlock] = useState(false);

  // Filters and Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [minSizeMB, setMinSizeMB] = useState('');
  const [maxSizeMB, setMaxSizeMB] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Local Storage Albums
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>([]);

  // Downloader State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0 to 100
  const [downloadStatusText, setDownloadStatusText] = useState('');
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [totalToDownload, setTotalToDownload] = useState(0);
  const [failedDownloads, setFailedDownloads] = useState<MediaItem[]>([]);

  // Media Preview Lightbox
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Quick stats computed from mediaItems
  const stats = useMemo(() => {
    let images = 0;
    let videos = 0;
    let others = 0;
    mediaItems.forEach(item => {
      if (item.type === 'image') images++;
      else if (item.type === 'video') videos++;
      else others++;
    });
    return {
      total: mediaItems.length,
      images,
      videos,
      others
    };
  }, [mediaItems]);

  // Load saved albums from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('balbums_saved_albums');
      if (stored) {
        setSavedAlbums(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Erro ao ler álbuns salvos:', e);
    }
  }, []);

  // Fetch default trending albums on mount
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const res = await fetch('/api/search-albums');
        if (res.ok) {
          const data = await res.json();
          setTrendingAlbums(data);
        }
      } catch (err) {
        console.error('Erro ao buscar álbuns populares:', err);
      }
    };
    loadTrending();
  }, []);

  // Clipboard Auto Paste functionality
  const handleAutoPaste = async (silent = false) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        if (!silent) {
          setErrorMessage('Seu navegador não suporta leitura automática da área de transferência. Por favor, use Ctrl+V ou Cmd+V.');
        }
        return;
      }

      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setPastedHtml(text);
        setClipboardStatus('success');
        setTimeout(() => setClipboardStatus('idle'), 2500);
      } else if (!silent) {
        setClipboardStatus('empty');
        setTimeout(() => setClipboardStatus('idle'), 2500);
      }
    } catch (err: any) {
      console.warn('Erro ao ler clipboard:', err);
      if (!silent) {
        setClipboardStatus('error');
        setTimeout(() => setClipboardStatus('idle'), 2500);
        
        const isIframeBlocked = err.message?.toLowerCase().includes('permissions policy') || 
                                err.message?.toLowerCase().includes('permission') ||
                                err.name === 'NotAllowedError' ||
                                window.self !== window.top;
                                
        if (isIframeBlocked) {
          setErrorMessage('A leitura automática do clipboard foi bloqueada pelas políticas de segurança do Iframe de visualização. Por favor, cole usando Ctrl+V ou Cmd+V diretamente na caixa de texto abaixo, ou clique no link de "Abrir em Nova Aba" no painel.');
        } else {
          setErrorMessage('Permissão negada ou erro ao ler a área de transferência. Por favor, cole usando Ctrl+V ou Cmd+V diretamente.');
        }
      }
    }
  };

  // Try to auto paste when entering the HTML tab
  useEffect(() => {
    if (activeTab === 'html') {
      handleAutoPaste(true);
    }
  }, [activeTab]);

  // Poll for bookmarklet automatic capture every 2 seconds
  useEffect(() => {
    let intervalId: any;
    
    const checkCapturedAlbum = async () => {
      try {
        const res = await fetch('/api/bookmarklet-poll');
        if (res.ok) {
          const data = await res.json();
          if (data.captured && data.data) {
            const { html, url, title } = data.data;
            console.log('[App] Álbum capturado automaticamente detectado!', title);
            parseHtmlAndSetAlbum(html, title, url);
            
            // Set success feedback message
            setSuccessMessage(`Álbum "${title}" capturado e importado com sucesso diretamente do seu navegador!`);
            setTimeout(() => setSuccessMessage(''), 8000);
          }
        }
      } catch (err) {
        // Fail silently in the background
      }
    };

    intervalId = setInterval(checkCapturedAlbum, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // Listen for message events from our same-origin webview iframe proxy
  useEffect(() => {
    const handleWebviewMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PROXY_LOADED') {
        const { html, url } = event.data;
        console.log('[App Webview] Conteúdo capturado via proxy-html!', url);
        setIsWebviewLoading(false);
        extractMediaFromHtml(html, url);
      }
    };

    window.addEventListener('message', handleWebviewMessage);
    return () => window.removeEventListener('message', handleWebviewMessage);
  }, []);

  // Extract media items specifically for the Webview Sandbox panel
  const extractMediaFromHtml = (htmlText: string, originalUrl: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Attempt to extract title
      let extractedTitle = doc.querySelector('title')?.textContent?.replace(' - Bunkr', '').replace(' - BAlbums', '').trim() || 
                           doc.querySelector('h1')?.textContent?.trim() || 
                           doc.querySelector('.album-title')?.textContent?.trim() || 
                           '';

      const items: MediaItem[] = [];
      const seenUrls = new Set<string>();

      // Try to determine the base URL of the original page to resolve relative paths
      let detectedBaseUrl = 'https://bunkr.cr';
      if (originalUrl) {
        try {
          detectedBaseUrl = new URL(originalUrl).origin;
          setActiveWebviewUrl(originalUrl);
        } catch (e) {}
      }

      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
                        doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
      
      if (canonical && (canonical.startsWith('http://') || canonical.startsWith('https://'))) {
        try {
          const u = new URL(canonical);
          detectedBaseUrl = u.origin;
        } catch (e) {}
      }

      // Strategy 1: Look for bunkr-style or general file grid items
      const links = doc.querySelectorAll('a');
      links.forEach((link, idx) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

        // Clean and resolve href
        let absoluteUrl = href;
        if (href.startsWith('//')) {
          absoluteUrl = 'https:' + href;
        } else if (href.startsWith('/')) {
          absoluteUrl = detectedBaseUrl + href;
        } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
          absoluteUrl = detectedBaseUrl + '/' + href;
        }

        absoluteUrl = rewriteBunkrUrl(absoluteUrl);
        const lowerHref = absoluteUrl.toLowerCase();
        
        // Is it a direct media file, or a viewing page?
        const isMediaFile = /\.(mp4|mkv|mov|webm|avi|jpg|jpeg|png|webp|gif|mp3|wav|ogg)$/.test(lowerHref);
        const isViewPage = /\/(v|i)\/[a-zA-Z0-9]+/.test(lowerHref);

        if (isMediaFile || isViewPage) {
          if (seenUrls.has(absoluteUrl)) return;
          seenUrls.add(absoluteUrl);

          // Find file name from child image alt, title attribute or link text
          let name = '';
          const imgChild = link.querySelector('img');
          if (imgChild) {
            name = imgChild.getAttribute('alt') || imgChild.getAttribute('title') || '';
          }
          if (!name) {
            name = link.getAttribute('title') || link.textContent?.trim() || '';
          }
          if (!name) {
            try {
              const parts = absoluteUrl.split('/');
              name = parts[parts.length - 1] || `file_${idx}`;
            } catch (e) {
              name = `file_${idx}`;
            }
          }

          // Determine type
          const type = /\.(mp4|mkv|mov|webm|avi)$/.test(lowerHref) || (isViewPage && lowerHref.includes('/v/')) ? 'video' : 'image';

          items.push({
            id: `webview_item_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            url: absoluteUrl,
            name: name,
            type: type,
            size: 'Desconhecido',
            isResolved: isMediaFile
          });
        }
      });

      // Strategy 2: Direct video tags
      const videos = doc.querySelectorAll('video source, video');
      videos.forEach((vid, idx) => {
        const src = vid.getAttribute('src');
        if (!src) return;

        let absoluteUrl = src;
        if (src.startsWith('//')) {
          absoluteUrl = 'https:' + src;
        } else if (src.startsWith('/')) {
          absoluteUrl = detectedBaseUrl + src;
        } else if (!src.startsWith('http://') && !src.startsWith('https://')) {
          absoluteUrl = detectedBaseUrl + '/' + src;
        }

        absoluteUrl = rewriteBunkrUrl(absoluteUrl);

        if (seenUrls.has(absoluteUrl)) return;
        seenUrls.add(absoluteUrl);

        items.push({
          id: `webview_vid_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          url: absoluteUrl,
          name: `video_${idx + 1}.mp4`,
          type: 'video',
          size: 'Desconhecido',
          isResolved: true
        });
      });

      // Fallback title deriving
      let finalTitle = extractedTitle;
      if (!finalTitle && items.length > 0) {
        const firstFileName = items[0].name;
        let cleanName = firstFileName.replace(/\.[a-zA-Z0-9]{2,4}$/, '')
                                     .replace(/[-_]\d+$/, '')
                                     .replace(/\d+$/, '')
                                     .replace(/[-_]/g, ' ')
                                     .trim();
        cleanName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (cleanName && cleanName.length > 3) {
          finalTitle = `Álbum - ${cleanName}`;
        }
      }

      if (!finalTitle) {
        finalTitle = 'Álbum Importado via Webview';
      }

      setWebviewMediaItems(items);
      setWebviewAlbumTitle(finalTitle);
    } catch (error) {
      console.error('Erro na extração do Webview:', error);
    }
  };

  // Handle Search on balbums.st
  const handleSearch = async (term: string) => {
    const cleanTerm = term.trim();
    setSearchTerm(cleanTerm);
    setSearchIsLoading(true);
    setIsSearching(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/search-albums?query=${encodeURIComponent(cleanTerm)}`);
      if (!response.ok) throw new Error('Falha ao buscar álbuns');
      const data = await response.json();
      setSearchResults(data);
    } catch (err: any) {
      setErrorMessage(`Erro ao realizar busca: ${err.message}`);
    } finally {
      setSearchIsLoading(false);
    }
  };

  // Select an album to load into the active viewer (support dynamic crawling fallback)
  const handleSelectAlbum = async (album: any) => {
    setAlbumTitle(album.title);
    setAlbumSourceUrl(album.url || '');
    setErrorMessage('');
    setViewMode('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (album.files && album.files.length > 0) {
      // Map files into MediaItem objects
      const mappedItems: MediaItem[] = album.files.map((file: any, idx: number) => ({
        id: `album_file_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        url: file.url,
        name: file.name,
        type: file.type || 'image',
        size: 'Ativo',
        isResolved: true
      }));

      setMediaItems(mappedItems);
      setSelectedIds(new Set(mappedItems.map(i => i.id)));
    } else if (album.url) {
      setIsLoading(true);
      setMediaItems([]);
      try {
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(album.url)}`);
        
        let data: any;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error('Expected JSON, got text/html:', text);
          if (text.toLowerCase().includes('cloudflare') || response.status === 403) {
            setCloudflareBlock(true);
            setErrorMessage('Bloqueio do Cloudflare detectado. Por favor, utilize o método de copiar e colar o código HTML da página.');
            setActiveTab('html');
          } else {
            setErrorMessage(`Falha ao obter dados do servidor (Status ${response.status}). Por favor, tente novamente ou utilize o método manual.`);
          }
          return;
        }

        if (!response.ok || data.error) {
          if (data.error === 'CF_BLOCK') {
            setCloudflareBlock(true);
            setErrorMessage(data.message || 'Bloqueio do Cloudflare detectado. Por favor, utilize o método de copiar e colar o código HTML da página.');
            setActiveTab('html');
          } else {
            setErrorMessage(data.message || 'Falha ao buscar álbuns da URL.');
          }
          return;
        }

        if (!data.items || data.items.length === 0) {
          setErrorMessage('Não foram encontrados arquivos de mídia nesse link.');
          return;
        }

        const mappedItems: MediaItem[] = data.items.map((item: any, idx: number) => ({
          id: `scrape_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          url: item.url,
          name: item.name || `arquivo_${idx + 1}`,
          type: item.type,
          size: item.size || 'Desconhecido',
          isResolved: item.isResolved
        }));

        setAlbumTitle(data.title || album.title);
        setMediaItems(mappedItems);
        setSelectedIds(new Set(mappedItems.map((i: any) => i.id)));
      } catch (err: any) {
        setErrorMessage(`Falha ao carregar conteúdo do álbum: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Save albums to LocalStorage
  const saveAlbumsToLocalStorage = (newAlbums: SavedAlbum[]) => {
    try {
      localStorage.setItem('balbums_saved_albums', JSON.stringify(newAlbums));
      setSavedAlbums(newAlbums);
    } catch (e) {
      console.error('Erro ao salvar álbuns:', e);
    }
  };

  // Generate the bookmarklet code with visual loader feedback and auto-fetch POST
  const getBookmarkletCode = () => {
    const code = `javascript:(function(){
  const html = document.documentElement.outerHTML;
  const currentUrl = window.location.href;
  const title = document.title || "Álbum Extraído";
  
  const loader = document.createElement("div");
  loader.style.position = "fixed";
  loader.style.top = "20px";
  loader.style.right = "20px";
  loader.style.padding = "16px 24px";
  loader.style.background = "#4f46e5";
  loader.style.color = "#ffffff";
  loader.style.fontFamily = "system-ui, -apple-system, sans-serif";
  loader.style.fontSize = "13px";
  loader.style.fontWeight = "bold";
  loader.style.borderRadius = "16px";
  loader.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)";
  loader.style.border = "1px solid rgba(255,255,255,0.1)";
  loader.style.zIndex = "9999999";
  loader.style.transition = "all 0.3s ease";
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.gap = "10px";
  loader.innerHTML = '<svg style="animation: spin 1s linear infinite; width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24"><circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path><style>@keyframes spin { 100% { transform: rotate(360deg); } }</style></svg> ⚡ Enviando para o Visualizador...';
  document.body.appendChild(loader);

  fetch("${window.location.origin}/api/bookmarklet-receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: html, url: currentUrl, title: title })
  })
  .then(res => res.json())
  .then(data => {
    loader.style.background = "#10b981";
    loader.innerHTML = '✅ Álbum importado com sucesso!';
    setTimeout(() => { loader.remove(); }, 3000);
  })
  .catch(err => {
    loader.style.background = "#ef4444";
    loader.innerHTML = '❌ Erro de conexão!';
    navigator.clipboard.writeText(html);
    setTimeout(() => { 
      loader.remove(); 
      alert("Não foi possível conectar ao visualizador, mas o código HTML foi copiado para sua área de transferência (clipboard)!");
    }, 1500);
  });
})();`;
    return code;
  };

  // Extract media items using client-side DOMParser (Extremely robust fallback)
  const parseHtmlAndSetAlbum = (htmlText: string, titleHint = '', originalUrl = '') => {
    if (!htmlText.trim()) {
      setErrorMessage('Por favor, cole o código HTML válido.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setCloudflareBlock(false);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Attempt to extract title
      let extractedTitle = doc.querySelector('title')?.textContent?.replace(' - Bunkr', '').replace(' - BAlbums', '').trim() || 
                       doc.querySelector('h1')?.textContent?.trim() || 
                       doc.querySelector('.album-title')?.textContent?.trim() || 
                       titleHint || 
                       '';

      const items: MediaItem[] = [];
      const seenUrls = new Set<string>();

      // Try to determine the base URL of the original page to resolve relative paths
      let detectedBaseUrl = 'https://bunkr.cr';
      
      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
                        doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
      
      if (canonical && (canonical.startsWith('http://') || canonical.startsWith('https://'))) {
        try {
          const u = new URL(canonical);
          detectedBaseUrl = u.origin;
        } catch (e) {}
      } else {
        // Fallback to any absolute link found in the page that points to bunkr or other media sites
        const allAnchors = Array.from(doc.querySelectorAll('a'));
        for (const a of allAnchors) {
          const h = a.getAttribute('href');
          if (h && (h.startsWith('http://') || h.startsWith('https://')) && !h.includes('twitter.com') && !h.includes('discord') && !h.includes('telegram')) {
            try {
              const u = new URL(h);
              detectedBaseUrl = u.origin;
              break;
            } catch (e) {}
          }
        }
      }

      // Strategy 1: Look for bunkr-style or general file grid items
      // Usually they have cards, paragraphs, or anchor links with filenames
      const links = doc.querySelectorAll('a');
      links.forEach((link, idx) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

        // Clean and resolve href
        let absoluteUrl = href;
        if (href.startsWith('//')) {
          absoluteUrl = 'https:' + href;
        } else if (href.startsWith('/')) {
          absoluteUrl = detectedBaseUrl + href;
        } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
          absoluteUrl = detectedBaseUrl + '/' + href;
        }

        absoluteUrl = rewriteBunkrUrl(absoluteUrl);
        const lowerHref = absoluteUrl.toLowerCase();
        
        // Is it a direct media file, or a viewing page?
        const isMediaFile = /\.(mp4|mkv|mov|webm|avi|jpg|jpeg|png|webp|gif|mp3|wav|ogg)$/.test(lowerHref);
        const isViewPage = /\/(v|i)\/[a-zA-Z0-9]+/.test(lowerHref);

        if (isMediaFile || isViewPage) {
          // Avoid duplicate links
          if (seenUrls.has(absoluteUrl)) return;
          seenUrls.add(absoluteUrl);

          // Find file name from child image alt, title attribute or link text
          let name = '';
          const imgChild = link.querySelector('img');
          if (imgChild) {
            name = imgChild.getAttribute('alt') || imgChild.getAttribute('title') || '';
          }
          if (!name) {
            name = link.getAttribute('title') || link.textContent?.trim() || '';
          }
          if (!name) {
            // derive from URL
            try {
              const parts = absoluteUrl.split('/');
              const filePart = parts[parts.length - 1];
              if (filePart && filePart.includes('.')) {
                name = decodeURIComponent(filePart);
              }
            } catch (e) {}
          }
          if (!name) {
            name = `arquivo_${idx + 1}`;
          }

          // File Size: search for sibling text containing MB/KB
          let size = 'Desconhecido';
          const parent = link.parentElement;
          if (parent) {
            const text = parent.textContent || '';
            const sizeMatch = text.match(/(\d+(?:\.\d+)?\s*(?:MB|KB|GB|bytes))/i);
            if (sizeMatch) {
              size = sizeMatch[1];
            }
          }

          const isVideo = lowerHref.includes('/v/') || /\.(mp4|mkv|mov|webm|avi)$/.test(lowerHref);
          const isImage = lowerHref.includes('/i/') || /\.(jpg|jpeg|png|webp|gif)$/.test(lowerHref);

          // Infer thumbnail if any
          let thumbnailUrl = imgChild?.getAttribute('src') || undefined;
          if (thumbnailUrl) {
            if (thumbnailUrl.startsWith('//')) {
              thumbnailUrl = 'https:' + thumbnailUrl;
            } else if (thumbnailUrl.startsWith('/')) {
              thumbnailUrl = detectedBaseUrl + thumbnailUrl;
            } else if (!thumbnailUrl.startsWith('http://') && !thumbnailUrl.startsWith('https://')) {
              thumbnailUrl = detectedBaseUrl + '/' + thumbnailUrl;
            }
            thumbnailUrl = rewriteBunkrUrl(thumbnailUrl);
          }

          items.push({
            id: `html_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            url: absoluteUrl,
            name: name,
            type: isVideo ? 'video' : (isImage ? 'image' : 'other'),
            size: size,
            thumbnailUrl: thumbnailUrl,
            isResolved: isMediaFile
          });
        }
      });

      // Strategy 2: If no links, look for direct video/image source elements
      if (items.length === 0) {
        // Direct images
        const images = doc.querySelectorAll('img');
        images.forEach((img, idx) => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (!src || src.startsWith('data:') || src.includes('avatar') || src.includes('logo')) return;

          let absoluteUrl = src;
          if (src.startsWith('//')) {
            absoluteUrl = 'https:' + src;
          } else if (src.startsWith('/')) {
            absoluteUrl = detectedBaseUrl + src;
          } else if (!src.startsWith('http://') && !src.startsWith('https://')) {
            absoluteUrl = detectedBaseUrl + '/' + src;
          }

          absoluteUrl = rewriteBunkrUrl(absoluteUrl);

          if (seenUrls.has(absoluteUrl)) return;
          seenUrls.add(absoluteUrl);

          const name = img.getAttribute('alt') || img.getAttribute('title') || `imagem_${idx + 1}.jpg`;
          items.push({
            id: `html_img_${idx}`,
            url: absoluteUrl,
            name: name,
            type: 'image',
            size: 'Desconhecido',
            thumbnailUrl: absoluteUrl,
            isResolved: true
          });
        });

        // Direct videos
        const videos = doc.querySelectorAll('video, source');
        videos.forEach((vid, idx) => {
          const src = vid.getAttribute('src');
          if (!src) return;

          let absoluteUrl = src;
          if (src.startsWith('//')) {
            absoluteUrl = 'https:' + src;
          } else if (src.startsWith('/')) {
            absoluteUrl = detectedBaseUrl + src;
          } else if (!src.startsWith('http://') && !src.startsWith('https://')) {
            absoluteUrl = detectedBaseUrl + '/' + src;
          }

          absoluteUrl = rewriteBunkrUrl(absoluteUrl);

          if (seenUrls.has(absoluteUrl)) return;
          seenUrls.add(absoluteUrl);

          const name = `video_${idx + 1}.mp4`;
          items.push({
            id: `html_vid_${idx}`,
            url: absoluteUrl,
            name: name,
            type: 'video',
            size: 'Desconhecido',
            isResolved: true
          });
        });
      }

      if (items.length === 0) {
        setErrorMessage('Nenhuma mídia encontrada no HTML colado. Certifique-se de que copiou o código fonte correto.');
        setIsLoading(false);
        return;
      }

      // Populate resolved items
      let finalTitle = extractedTitle;
      if (!finalTitle || finalTitle === 'Novo Álbum Customizado' || finalTitle === 'Álbum Extraído de HTML') {
        // Try to derive from the first file name!
        if (items.length > 0) {
          const firstFileName = items[0].name;
          // Strip extension, numbers, and common prefix
          let cleanName = firstFileName.replace(/\.[a-zA-Z0-9]{2,4}$/, '') // remove extension
                                       .replace(/[-_]\d+$/, '') // remove trailing numbers
                                       .replace(/\d+$/, '')
                                       .replace(/[-_]/g, ' ') // replace dashes/underscores with spaces
                                       .trim();
          // Capitalize words
          cleanName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (cleanName && cleanName.length > 3) {
            finalTitle = `Álbum - ${cleanName}`;
          }
        }
      }
      
      if (!finalTitle) {
        // Fallback to a timestamped name
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR');
        finalTitle = `Álbum Extraído às ${timeStr}`;
      }

      setAlbumTitle(finalTitle);
      setAlbumSourceUrl(originalUrl || '');
      if (originalUrl) {
        setInputUrl(originalUrl);
      }
      setMediaItems(items);
      setViewMode('viewer');
      
      // Auto-select all items
      setSelectedIds(new Set(items.map(i => i.id)));
      
      // Feedback positive
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage(`Erro ao processar HTML: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Perform server-side scraping of a URL
  const handleUrlScrape = async () => {
    if (!inputUrl) {
      setErrorMessage('Por favor, digite um link de álbum válido.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setCloudflareBlock(false);
    setMediaItems([]);

    try {
      // Direct call to our backend api
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(inputUrl)}`);
      
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Expected JSON, got non-JSON response:', text);
        if (text.toLowerCase().includes('cloudflare') || response.status === 403) {
          data = { error: 'CF_BLOCK', message: 'Bloqueio do Cloudflare detectado. Por favor, utilize o método de copiar e colar o código HTML da página.' };
        } else {
          throw new Error('Formato de resposta inválido do servidor de raspagem. Verifique a URL ou utilize o método manual.');
        }
      }

      if (!response.ok || data.error) {
        if (data.error === 'CF_BLOCK') {
          setCloudflareBlock(true);
          setErrorMessage(data.message || 'Bloqueio do Cloudflare detectado. Por favor, utilize o método de copiar e colar o código HTML da página.');
          // Auto switch to HTML tab so user can paste
          setActiveTab('html');
        } else {
          setErrorMessage(data.message || 'Falha ao buscar álbuns da URL.');
        }
        setIsLoading(false);
        return;
      }

      if (!data.items || data.items.length === 0) {
        setErrorMessage('Não foram encontrados arquivos de mídia nesse link.');
        setIsLoading(false);
        return;
      }

      // Map to add unique React IDs and formatting
      const mappedItems: MediaItem[] = data.items.map((item: any, idx: number) => ({
        id: `scrape_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        url: item.url,
        name: item.name || `arquivo_${idx + 1}`,
        type: item.type,
        size: item.size || 'Desconhecido',
        isResolved: item.isResolved
      }));

      setAlbumTitle(data.title || 'Álbum Importado');
      setAlbumSourceUrl(data.sourceUrl);
      setMediaItems(mappedItems);
      setViewMode('viewer');
      setSelectedIds(new Set(mappedItems.map((i: any) => i.id)));
      
      // Add a message about resolving individual pages
      const unresCount = mappedItems.filter(i => !i.isResolved).length;
      if (unresCount > 0) {
        console.log(`${unresCount} itens precisam de resolução de link individual.`);
      }

    } catch (err: any) {
      setErrorMessage(`Falha na conexão com o servidor de raspagem: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe file downloader with individual CORS bypassing proxy and batch processing
  const handleDownloadAll = async () => {
    const itemsToDownload = mediaItems.filter(item => selectedIds.has(item.id));
    if (itemsToDownload.length === 0) {
      alert('Nenhum arquivo selecionado para download.');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedCount(0);
    setTotalToDownload(itemsToDownload.length);
    setFailedDownloads([]);
    setDownloadStatusText('Iniciando empacotamento em ZIP...');

    const zip = new JSZip();
    const batchSize = 3; // Max parallel files to fetch
    let count = 0;

    // Helper to resolve the direct download URL (for view pages like bunkr.si/v/xxx)
    const resolveDirectUrl = async (item: MediaItem): Promise<string> => {
      if (item.isResolved) return item.url;
      
      // If it is a bunkr/balbum page view (e.g., https://bunkr.is/v/xxxx)
      // We make a server-side query to fetch the page, parse its direct video source, and return it.
      try {
        setDownloadStatusText(`Resolvendo link direto para: ${item.name}...`);
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(item.url)}`);
        if (!response.ok) return item.url;
        
        let data: any;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          return item.url;
        }
        
        // Find if there is a resolved direct media link in this view page
        const directMedia = data.items.find((i: any) => i.isResolved);
        if (directMedia) {
          item.url = directMedia.url;
          item.isResolved = true;
          return directMedia.url;
        }
      } catch (e) {
        console.error('Erro ao resolver link:', e);
      }
      return item.url;
    };

    // Download in chunks to avoid out of memory issues
    for (let i = 0; i < itemsToDownload.length; i += batchSize) {
      const currentBatch = itemsToDownload.slice(i, i + batchSize);
      
      await Promise.all(currentBatch.map(async (item) => {
        try {
          // 1. Resolve direct download link if needed
          const directUrl = await resolveDirectUrl(item);

          // 2. Fetch binary via proxy to bypass CORS
          setDownloadStatusText(`Fazendo download de: ${item.name}...`);
          
          // Use our media proxy API
          const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(directUrl)}`;
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP erro! status: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          // 3. Add to JSZip
          // Ensure a unique filename to prevent collisions inside zip
          let cleanName = item.name.replace(/[\/\\?%*:|"<>\s]+/g, '_');
          if (!cleanName.includes('.') && item.type !== 'other') {
            cleanName += item.type === 'video' ? '.mp4' : '.jpg';
          }
          zip.file(cleanName, blob);
          
          count++;
          setDownloadedCount(count);
          setDownloadHistory(prev => [{...item, downloadedAt: new Date()}, ...prev]);
          setDownloadProgress(Math.round((count / itemsToDownload.length) * 80)); // Max 80% for download phase
        } catch (error) {
          console.error(`Falha no download de ${item.name}:`, error);
          setFailedDownloads(prev => [...prev, item]);
        }
      }));
    }

    // Zip compression phase (80% to 100%)
    if (count > 0) {
      setDownloadStatusText('Compactando arquivos no formato ZIP. Aguarde...');
      try {
        const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
          const zipPercent = Math.round(80 + (metadata.percent / 100) * 20);
          setDownloadProgress(zipPercent);
        });

        setDownloadStatusText('Download Concluído! Salvando arquivo...');
        
        // Save using native link trigger
        const blobUrl = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = blobUrl;
        
        // Use album title or current date as ZIP filename
        const safeTitle = albumTitle.replace(/[\/\\?%*:|"<>\s]+/g, '_') || 'album_bmidias';
        link.download = `${safeTitle}.zip`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        // Explode beautiful confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        setDownloadStatusText('Sucesso! O download do seu arquivo ZIP começou.');
      } catch (err: any) {
        setDownloadStatusText(`Erro ao gerar arquivo ZIP: ${err.message}`);
      }
    } else {
      setDownloadStatusText('Falha ao baixar os arquivos selecionados. Tente baixar individualmente.');
    }

    setIsDownloading(false);
  };

  // Download a single file individually bypassing CORS (memory-safe native download stream)
  const handleDownloadSingle = async (item: MediaItem) => {
    try {
      setDownloadStatusText(`Resolvendo link para ${item.name}...`);
      
      // 1. Resolve link if needed
      let directUrl = item.url;
      if (!item.isResolved) {
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(item.url)}`);
        if (response.ok) {
          let data: any;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
            const directMedia = data?.items?.find((i: any) => i.isResolved);
            if (directMedia) directUrl = directMedia.url;
          }
        }
      }

      // 2. Trigger native browser stream download via proxy (ZERO memory-overhead)
      setDownloadStatusText(`Baixando: ${item.name} via navegador...`);
      const finalDownloadUrl = `/api/proxy-media?url=${encodeURIComponent(directUrl)}&download=true&filename=${encodeURIComponent(item.name)}`;
      
      const link = document.createElement('a');
      link.href = finalDownloadUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadStatusText('Download iniciado pelo navegador com sucesso!');
      
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 }
      });
    } catch (e: any) {
      alert(`Falha no download direto: ${e.message}. Tente abrir o link e salvar manualmente.`);
    }
  };

  // Safe multi-downloader triggering successive browser stream downloads
  const handleDownloadAllIndividual = async () => {
    const itemsToDownload = mediaItems.filter(item => selectedIds.has(item.id));
    if (itemsToDownload.length === 0) {
      alert('Nenhum arquivo selecionado para download.');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedCount(0);
    setTotalToDownload(itemsToDownload.length);
    setFailedDownloads([]);
    setDownloadStatusText('Iniciando disparos de download sequencial...');

    let count = 0;
    
    const resolveDirectUrl = async (item: MediaItem): Promise<string> => {
      if (item.isResolved) return item.url;
      try {
        setDownloadStatusText(`Resolvendo: ${item.name}...`);
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(item.url)}`);
        if (!response.ok) return item.url;
        
        let data: any;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          return item.url;
        }
        
        const directMedia = data.items.find((i: any) => i.isResolved);
        if (directMedia) {
          item.url = directMedia.url;
          item.isResolved = true;
          return directMedia.url;
        }
      } catch (e) {
        console.error('Erro ao resolver link:', e);
      }
      return item.url;
    };

    for (let i = 0; i < itemsToDownload.length; i++) {
      const item = itemsToDownload[i];
      try {
        const directUrl = await resolveDirectUrl(item);
        setDownloadStatusText(`Baixando (${i + 1}/${itemsToDownload.length}): ${item.name}`);
        
        const finalDownloadUrl = `/api/proxy-media?url=${encodeURIComponent(directUrl)}&download=true&filename=${encodeURIComponent(item.name)}`;
        
        const link = document.createElement('a');
        link.href = finalDownloadUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        count++;
        setDownloadedCount(count);
        setDownloadHistory(prev => [{...item, downloadedAt: new Date()}, ...prev]);
        setDownloadProgress(Math.round((count / itemsToDownload.length) * 100));
        
        // Wait 400ms between streams to prevent browsers blocking popups or multiple downloads
        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (error) {
        console.error(`Falha no download para ${item.name}:`, error);
        setFailedDownloads(prev => [...prev, item]);
      }
    }

    setDownloadStatusText(`Fila concluída! Downloads iniciados com sucesso: ${count}/${itemsToDownload.length}`);
    setIsDownloading(false);
    
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Export selected URLs to a .txt file
  const handleExportUrls = async () => {
    const itemsToExport = mediaItems.filter(item => selectedIds.has(item.id));
    if (itemsToExport.length === 0) {
      alert('Nenhum arquivo selecionado para exportar.');
      return;
    }

    setIsDownloading(true);
    setDownloadStatusText('Resolvendo links para exportação...');
    
    const resolveDirectUrl = async (item: MediaItem): Promise<string> => {
      if (item.isResolved) return item.url;
      try {
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(item.url)}`);
        if (!response.ok) return item.url;
        
        let data: any;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          return item.url;
        }
        
        const directMedia = data.items.find((i: any) => i.isResolved);
        if (directMedia) {
          item.url = directMedia.url;
          item.isResolved = true;
          return directMedia.url;
        }
      } catch (e) {
        console.error('Erro ao resolver link:', e);
      }
      return item.url;
    };

    try {
      const resolvedUrls: string[] = [];
      for (let i = 0; i < itemsToExport.length; i++) {
        const item = itemsToExport[i];
        setDownloadStatusText(`Resolvendo (${i + 1}/${itemsToExport.length}): ${item.name}`);
        const url = await resolveDirectUrl(item);
        resolvedUrls.push(url);
      }

      const textContent = resolvedUrls.join('\n');
      const blob = new Blob([textContent], { type: 'text/plain' });
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      const safeTitle = albumTitle ? albumTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'export';
      link.download = `urls_${safeTitle}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      setDownloadStatusText(`Sucesso! ${resolvedUrls.length} URLs exportadas.`);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch (e) {
      console.error('Erro ao exportar URLs:', e);
      alert('Houve um erro ao exportar as URLs.');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadStatusText(''), 3000);
    }
  };

  // Add current album to Saved Albums Library
  const handleSaveAlbumToLibrary = () => {
    if (mediaItems.length === 0) return;
    
    // Check if already saved
    const exists = savedAlbums.some(a => a.title === albumTitle);
    if (exists) {
      alert('Este álbum já está salvo na sua biblioteca local!');
      return;
    }

    const newAlbum: SavedAlbum = {
      id: `saved_${Date.now()}`,
      title: albumTitle || 'Sem Título',
      sourceUrl: albumSourceUrl || undefined,
      itemsCount: mediaItems.length,
      items: mediaItems,
      savedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const updated = [newAlbum, ...savedAlbums];
    saveAlbumsToLocalStorage(updated);
    
    // Animate some mini confetti
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });

    alert('Álbum salvo com sucesso na sua biblioteca local!');
  };

  // Delete an album from the library
  const handleDeleteSavedAlbum = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este álbum da sua biblioteca?')) {
      const updated = savedAlbums.filter(a => a.id !== id);
      saveAlbumsToLocalStorage(updated);
    }
  };

  // Load saved album into active viewer
  const handleLoadSavedAlbum = (album: SavedAlbum) => {
    setAlbumTitle(album.title);
    setAlbumSourceUrl(album.sourceUrl || '');
    setMediaItems(album.items);
    setSelectedIds(new Set(album.items.map(i => i.id)));
    setErrorMessage('');
    setViewMode('viewer');
    // Switch to active viewer tab
    setActiveTab('url');
  };

  // Selection controls
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems();
    const next = new Set(selectedIds);
    filteredItems.forEach(item => next.add(item.id));
    setSelectedIds(next);
  };

  const handleSelectNone = () => {
    const filteredItems = getFilteredItems();
    const next = new Set(selectedIds);
    filteredItems.forEach(item => next.delete(item.id));
    setSelectedIds(next);
  };

  const handleInvertSelection = () => {
    const filteredItems = getFilteredItems();
    const next = new Set(selectedIds);
    filteredItems.forEach(item => {
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
    });
    setSelectedIds(next);
  };

  const parseSizeToMB = (sizeStr: string): number | null => {
    if (!sizeStr || sizeStr === 'Desconhecido') return null;
    const match = sizeStr.match(/([\d\.]+)\s*(MB|KB|GB|B)/i);
    if (!match) return null;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === 'GB') return val * 1024;
    if (unit === 'MB') return val;
    if (unit === 'KB') return val / 1024;
    if (unit === 'B') return val / (1024 * 1024);
    return null;
  };

  // Filter logic with multi-term support (AND matching)
  const getFilteredItems = () => {
    const terms = searchQuery
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(t => t.trim().length > 0);

    const minSize = minSizeMB ? parseFloat(minSizeMB) : null;
    const maxSize = maxSizeMB ? parseFloat(maxSizeMB) : null;

    return mediaItems.filter(item => {
      const nameLower = item.name.toLowerCase();
      // If terms are present, check if all of them are contained in the filename
      const matchesSearch = terms.length === 0 || terms.every(term => nameLower.includes(term));
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      
      let matchesSize = true;
      if (minSize !== null || maxSize !== null) {
        const itemSizeMB = parseSizeToMB(item.size);
        if (itemSizeMB !== null) {
          if (minSize !== null && itemSizeMB < minSize) matchesSize = false;
          if (maxSize !== null && itemSizeMB > maxSize) matchesSize = false;
        } else {
          // If size is unknown, and we have a size filter, do we exclude it?
          // Let's exclude unknown sizes if a size filter is applied.
          matchesSize = false;
        }
      }

      return matchesSearch && matchesType && matchesSize;
    });
  };

  // Extract dynamic search term suggestions based on loaded media names
  const getSearchSuggestions = () => {
    if (mediaItems.length === 0) return { extensions: [], words: [] };
    
    const wordCounts: { [key: string]: number } = {};
    const extensions = new Set<string>();
    
    mediaItems.forEach(item => {
      // 1. Collect extension
      const extMatch = item.name.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        extensions.add(extMatch[1].toLowerCase());
      }
      
      // 2. Tokenize filename
      const cleanName = item.name.replace(/\.[a-zA-Z0-9]+$/, ''); // remove extension
      const tokens = cleanName
        .toLowerCase()
        .split(/[\s_\-\.\(\)\[\]]+/)
        .filter(t => t.length >= 3 && isNaN(Number(t))); // min 3 chars, not numbers
      
      // Stop words to ignore in suggestions
      const stopWords = new Set(['para', 'com', 'dos', 'das', 'uma', 'uns', 'bunkr', 'com', 'www', 'http', 'https', 'file', 'arquivo', 'video', 'foto', 'image']);
      
      tokens.forEach(token => {
        if (!stopWords.has(token)) {
          wordCounts[token] = (wordCounts[token] || 0) + 1;
        }
      });
    });
    
    // Sort words by frequency
    const topWords = Object.entries(wordCounts)
      .filter(([_, count]) => count > 1) // only words that appear more than once
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 4);
      
    return {
      extensions: Array.from(extensions).slice(0, 5),
      words: topWords
    };
  };

  // Format Proxy stream URL for custom video player
  const getProxyMediaUrl = (url: string) => {
    return `/api/proxy-media?url=${encodeURIComponent(url)}`;
  };

  // Simple size display helper
  const cleanSize = (size: string) => {
    return size === 'Desconhecido' ? 'N/A' : size;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header Panel */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div 
            onClick={() => setViewMode('search')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/10 border border-indigo-400/20 group-hover:scale-105 transition-transform duration-200">
              <FileArchive className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-violet-200 bg-clip-text text-transparent flex items-center gap-1.5">
                balbums<span className="text-indigo-400 font-black">.st</span>
                <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Clone</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium group-hover:text-indigo-300 transition-colors">
                Buscador & Downloader de Mídias Completo
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex flex-wrap items-center justify-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => {
                setViewMode('search');
              }}
              id="nav-tab-search"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'search'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Buscar Álbuns
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('url');
              }}
              id="nav-tab-url"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'url'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Link Direto
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('webview');
              }}
              id="nav-tab-webview"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'webview'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Navegador Webview 🌐
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('html');
              }}
              id="nav-tab-html"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'html'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Colar Código HTML
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('bookmarklet');
              }}
              id="nav-tab-bookmarklet"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'bookmarklet'
                  ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md'
                  : 'text-amber-400/90 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Auto-Captura ⚡
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('saved');
              }}
              id="nav-tab-saved"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'saved'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Biblioteca ({savedAlbums.length})
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('history');
              }}
              id="nav-tab-history"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Histórico
            </button>
            <button
              onClick={() => {
                setViewMode('viewer');
                setActiveTab('help');
              }}
              id="nav-tab-help"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === 'viewer' && activeTab === 'help'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Ajuda
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full flex flex-col gap-6">

        {/* Global Loading or Error Banner */}
        {errorMessage && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-rose-300">Atenção</h4>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">{errorMessage}</p>
              {cloudflareBlock && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('html');
                      setErrorMessage('');
                    }}
                    className="bg-rose-850 hover:bg-rose-800 text-rose-100 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-700/50 transition duration-150"
                  >
                    Ir para Colar HTML (Garantido)
                  </button>
                  {(albumSourceUrl || inputUrl) && (
                    <a
                      href={albumSourceUrl || inputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-transparent hover:bg-rose-900/40 text-rose-300 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-rose-800/50 flex items-center gap-1 transition duration-150"
                    >
                      Abrir Álbum Original <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-4 duration-300">
            <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-emerald-300">Captura Automática</h4>
              <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">{successMessage}</p>
            </div>
          </div>
        )}

        {viewMode === 'search' ? (
          /* BALBUMS.ST SEARCH ENGINE REPLICA */
          <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
            {/* Logo/Branding section */}
            <div className="text-center py-6 flex flex-col items-center gap-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full"></div>
                <h2 className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-400 bg-clip-text text-transparent select-none">
                  balbums<span className="text-indigo-500">.st</span>
                </h2>
              </div>
              <p className="text-xs md:text-sm text-slate-400 max-w-xl leading-relaxed">
                O maior agregador e buscador de álbuns de mídia da internet. Pesquise por termos, explore vazamentos e faça o download completo de arquivos em formato ZIP.
              </p>
            </div>

            {/* Search Input Box Card */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm max-w-3xl mx-auto w-full">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-3xl -z-10"></div>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch(searchTerm);
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite nomes de modelos, influenciadores, marcas ou termos..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 rounded-2xl py-4 pl-5 pr-12 text-xs text-slate-100 placeholder:text-slate-600 transition duration-150 shadow-inner"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setIsSearching(false);
                        setSearchResults([]);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 rounded-full hover:bg-slate-900 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searchIsLoading}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white text-xs font-bold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {searchIsLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Pesquisar
                    </>
                  )}
                </button>
              </form>

              {/* Hot suggestions keywords */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Termos quentes:</span>
                {["OnlyFans", "Vazados", "Amadores", "TikTok", "MC Pipokinha", "Amouranth", "Corinna Kopf", "Privacy", "Bunkr"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchTerm(tag);
                      handleSearch(tag);
                    }}
                    className="bg-slate-950/60 hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-300 border border-slate-850 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-150 cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            {searchIsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="bg-slate-900 p-5 rounded-full border border-slate-800 text-indigo-400 shadow-inner animate-pulse">
                  <RefreshCw className="h-10 w-10 animate-spin text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Pesquisando Álbuns na Base de Dados</h3>
                  <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                    Vasculhando índices locais e gerando novos resultados inteligentes usando Inteligência Artificial se o termo for novo. Isso pode levar de 2 a 5 segundos...
                  </p>
                </div>
              </div>
            ) : isSearching ? (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Resultados para "{searchTerm}"
                  </h3>
                  <button
                    onClick={() => {
                      setIsSearching(false);
                      setSearchResults([]);
                      setSearchTerm('');
                    }}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                  >
                    Limpar Busca
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-4">
                    <AlertTriangle className="h-10 w-10 text-slate-700" />
                    <div>
                      <p className="text-xs font-bold text-slate-300">Nenhum álbum correspondente encontrado</p>
                      <p className="text-[10px] text-slate-500 mt-1">Tente pesquisar termos mais genéricos ou use um de nossos termos sugeridos.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.map((album) => (
                      <div
                        key={album.id}
                        onClick={() => handleSelectAlbum(album)}
                        className="group bg-slate-900/30 hover:bg-slate-900 border border-slate-850 hover:border-indigo-500/40 p-4.5 rounded-3xl flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-indigo-500/5 relative overflow-hidden"
                      >
                        {/* Cover Image */}
                        <div className="aspect-video w-full rounded-2xl bg-slate-950 overflow-hidden border border-slate-850 relative">
                          {album.thumbnail ? (
                            <img
                              src={album.thumbnail}
                              alt={album.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-800">
                              <FileArchive className="h-10 w-10 opacity-40" />
                            </div>
                          )}
                          <span className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-sm text-indigo-300 border border-indigo-500/20 text-[10px] px-2 py-0.5 rounded-lg font-bold shadow">
                            {album.itemsCount || album.files?.length || 0} arquivos
                          </span>
                        </div>

                        {/* Title details */}
                        <div className="flex flex-col flex-1 justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-200 group-hover:text-indigo-400 truncate transition-colors">
                              {album.title}
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {album.host && (
                                <span className="bg-indigo-500/10 text-indigo-400 text-[9px] border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-extrabold uppercase">
                                  {album.host}
                                </span>
                              )}
                              {(album.tags || []).slice(0, 3).map((tag: string) => (
                                <span key={tag} className="bg-slate-950 text-slate-400 text-[9px] border border-slate-850 px-1.5 py-0.5 rounded-md">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-850/60 mt-auto text-[10px] text-slate-500">
                            <span>Adicionado: {album.addedDate || "Recente"}</span>
                            <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                              Acessar Álbum <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TRENDING ALBUMS SECTION */
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                    🔥 Álbuns Recentes & Populares
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Atualizado em tempo real</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trendingAlbums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => handleSelectAlbum(album)}
                      className="group bg-slate-900/30 hover:bg-slate-900 border border-slate-850 hover:border-indigo-500/40 p-4.5 rounded-3xl flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-indigo-500/5 relative overflow-hidden"
                    >
                      {/* Cover Photo */}
                      <div className="aspect-video w-full rounded-2xl bg-slate-950 overflow-hidden border border-slate-850 relative">
                        {album.thumbnail ? (
                          <img
                            src={album.thumbnail}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-800">
                            <FileArchive className="h-10 w-10 opacity-40" />
                          </div>
                        )}
                        <span className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-sm text-indigo-300 border border-indigo-500/20 text-[10px] px-2 py-0.5 rounded-lg font-bold shadow">
                          {album.itemsCount || album.files?.length || 0} arquivos
                        </span>
                      </div>

                      {/* Content details */}
                      <div className="flex flex-col flex-1 justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-200 group-hover:text-indigo-400 truncate transition-colors">
                            {album.title}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {album.host && (
                              <span className="bg-indigo-500/10 text-indigo-400 text-[9px] border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-extrabold uppercase">
                                {album.host}
                              </span>
                            )}
                            {(album.tags || []).slice(0, 3).map((tag: string) => (
                              <span key={tag} className="bg-slate-950 text-slate-400 text-[9px] border border-slate-850 px-1.5 py-0.5 rounded-md">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-850/60 mt-auto text-[10px] text-slate-500">
                          <span>Adicionado: {album.addedDate || "Recente"}</span>
                          <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                            Acessar Álbum <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'webview' ? (
          /* EMBEDDED WEBVIEW SANDBOX AND SCRAPER */
          <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
            {/* Header info bar */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-3xl -z-10"></div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-slate-100">Navegador Webview Integrado (Safe Sandbox)</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                    Navegue nos sites originais diretamente por aqui. O tráfego de rede é encapsulado de forma segura, permitindo que nosso sistema <strong>capture os arquivos de mídia automaticamente em tempo real</strong> sem violar políticas de segurança do navegador (CORS/Same-Origin Bypass).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <span className="bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                    Same-Origin Proxy Active 🌐
                  </span>
                  <span className="bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                    Bypass Inteligente ⚡
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Side: Mock Browser Panel (8 Columns) */}
              <div className="lg:col-span-8 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
                
                {/* Browser address bar and controls */}
                <div className="bg-slate-950 p-4 border-b border-slate-850 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Mock Navigation Arrows */}
                    <button 
                      onClick={() => {
                        // Simply reloads/goes back home
                        setActiveWebviewUrl('https://bunkr.cr');
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Voltar ao início"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        // Refresh the iframe
                        const temp = activeWebviewUrl;
                        setActiveWebviewUrl('');
                        setTimeout(() => {
                          if (temp) setActiveWebviewUrl(temp);
                        }, 50);
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Atualizar Página"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isWebviewLoading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                  </div>

                  {/* Address input */}
                  <div className="flex-1 relative flex items-center">
                    <Globe className="h-3.5 w-3.5 text-slate-600 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={webviewInputUrl}
                      onChange={(e) => setWebviewInputUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          let finalUrl = webviewInputUrl.trim();
                          if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                            finalUrl = 'https://' + finalUrl;
                            setWebviewInputUrl(finalUrl);
                          }
                          setIsWebviewLoading(true);
                          setActiveWebviewUrl(finalUrl);
                        }
                      }}
                      placeholder="Insira a URL do álbum (ex: bunkr.cr ou balbums.st)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-24 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-mono"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button
                        onClick={() => {
                          let finalUrl = webviewInputUrl.trim();
                          if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                            finalUrl = 'https://' + finalUrl;
                            setWebviewInputUrl(finalUrl);
                          }
                          setIsWebviewLoading(true);
                          setActiveWebviewUrl(finalUrl);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg transition"
                      >
                        Navegar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-status header bar */}
                {activeWebviewUrl && (
                  <div className="bg-slate-950/40 px-4 py-2 border-b border-slate-850/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="truncate max-w-md">URL Atual: <span className="text-slate-400">{activeWebviewUrl}</span></span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Sandbox Ativa
                    </span>
                  </div>
                )}

                {/* Simulated Iframe Stage */}
                <div className="flex-1 bg-slate-950 min-h-[550px] relative">
                  {activeWebviewUrl ? (
                    <iframe
                      src={`/api/proxy-html?url=${encodeURIComponent(activeWebviewUrl)}`}
                      className="w-full h-full min-h-[550px] bg-slate-950 border-0"
                      onLoad={() => setIsWebviewLoading(false)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    /* Initial browser landing helper */
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 gap-6 bg-slate-950">
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-indigo-400 animate-pulse">
                        <Globe className="h-8 w-8" />
                      </div>
                      <div className="space-y-1.5 max-w-sm">
                        <h4 className="text-sm font-bold text-slate-200">Pronto para Carregar</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Digite qualquer URL de álbum acima (Bunkr ou BAlbums) e clique em navegar. O sistema abrirá a página de forma interativa.
                        </p>
                      </div>

                      {/* Quick links */}
                      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                        <div
                          onClick={() => {
                            const url = 'https://bunkr.cr';
                            setWebviewInputUrl(url);
                            setActiveWebviewUrl(url);
                            setIsWebviewLoading(true);
                          }}
                          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl cursor-pointer transition text-left"
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-500">Site Oficial</span>
                          <h5 className="text-xs font-bold text-slate-200 mt-1">Bunkr.cr</h5>
                          <p className="text-[10px] text-slate-600 mt-0.5 leading-normal">Página inicial do maior portal de arquivos digitais.</p>
                        </div>
                        <div
                          onClick={() => {
                            const url = 'https://balbums.st';
                            setWebviewInputUrl(url);
                            setActiveWebviewUrl(url);
                            setIsWebviewLoading(true);
                          }}
                          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl cursor-pointer transition text-left"
                        >
                          <span className="text-[9px] uppercase font-bold text-indigo-500">Diretório</span>
                          <h5 className="text-xs font-bold text-slate-200 mt-1">BAlbums.st</h5>
                          <p className="text-[10px] text-slate-600 mt-0.5 leading-normal">Explore o acervo completo de álbuns compartilhados.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Browser Spinner Overlay */}
                  {isWebviewLoading && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                      <p className="text-xs font-bold text-slate-400 font-mono">Bypassando Cloudflare & Carregando...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Extraction Monitor Panel (4 Columns) */}
              <div className="lg:col-span-4 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 shadow-xl justify-between">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Captura em Tempo Real</h4>
                    </div>
                    {webviewMediaItems.length > 0 && (
                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {webviewMediaItems.length} Arquivos
                      </span>
                    )}
                  </div>

                  {webviewMediaItems.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[300px]">
                      <span className="text-3xl animate-pulse">📡</span>
                      <div>
                        <h5 className="text-xs font-bold text-slate-300">Aguardando Navegação</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                          Navegue até a página de qualquer álbum no painel ao lado. Nosso scraper interceptará os arquivos instantaneamente!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Album details */}
                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850/80 space-y-1">
                        <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Álbum Capturado</span>
                        <h5 className="text-xs font-bold text-slate-200 leading-snug line-clamp-2">{webviewAlbumTitle}</h5>
                        <p className="text-[9px] font-mono text-slate-500 truncate" title={activeWebviewUrl}>
                          {activeWebviewUrl}
                        </p>
                      </div>

                      {/* File preview stream list */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">Lista de Arquivos Detectados</label>
                        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                          {webviewMediaItems.map((item) => (
                            <div 
                              key={item.id}
                              className="bg-slate-950/40 border border-slate-850/60 hover:border-slate-800 p-2 rounded-xl flex items-center justify-between gap-2.5 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs shrink-0">
                                  {item.type === 'video' ? '🎥' : '🖼️'}
                                </span>
                                <p className="text-[10px] font-mono text-slate-300 truncate" title={item.name}>
                                  {item.name}
                                </p>
                              </div>
                              <span className="text-[9px] text-slate-600 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded uppercase shrink-0 font-bold tracking-wider">
                                {item.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Import triggers */}
                {webviewMediaItems.length > 0 && (
                  <div className="pt-4 border-t border-slate-850 mt-6 flex flex-col gap-3 font-sans">
                    <div className="text-[10px] text-slate-400 leading-normal bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-3 flex gap-2 items-start">
                      <span className="text-xs">💡</span>
                      <p>
                        Clique no botão abaixo para carregar todos esses {webviewMediaItems.length} arquivos diretamente no nosso visualizador avançado para iniciar transmissões, pré-visualizações ou download em ZIP!
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        // Import all into main visualizer
                        setMediaItems(webviewMediaItems);
                        setAlbumTitle(webviewAlbumTitle);
                        setAlbumSourceUrl(activeWebviewUrl);
                        setInputUrl(activeWebviewUrl);
                        setSelectedIds(new Set(webviewMediaItems.map(i => i.id)));
                        setViewMode('viewer');
                        setActiveTab('url');
                        
                        // Show beautiful feedback
                        setSuccessMessage(`Álbum "${webviewAlbumTitle}" carregado com sucesso na Galeria de Visualização!`);
                        setTimeout(() => setSuccessMessage(''), 8000);
                        
                        // Fire a fancy confetti celebration!
                        confetti({
                          particleCount: 100,
                          spread: 70,
                          origin: { y: 0.6 },
                          colors: ['#4f46e5', '#818cf8', '#10b981', '#34d399']
                        });
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      <span>Importar para a Galeria!</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Main Tab Panels */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Action Dashboard Side: 5 Cols on LG */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Input card */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-3xl -z-10"></div>
              
              {/* Tab 1: Scraper Direct link */}
              {activeTab === 'url' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Link de Álbum Direto</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Insira o link de um álbum do <strong>BAlbums</strong> ou <strong>Bunkr</strong> para importar as mídias. O servidor processará e contornará as proteções básicas de CORS.
                  </p>

                  <div className="space-y-1 mt-1">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">URL do Álbum</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="https://balbums.st/a/... ou https://bunkr.is/a/..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-2xl py-3 pl-4 pr-10 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                      />
                      <button
                        onClick={handleUrlScrape}
                        disabled={isLoading}
                        className="absolute right-2 top-2 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 transition"
                      >
                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-500" /> : <Search className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleUrlScrape}
                    disabled={isLoading}
                    id="btn-scrape"
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white text-xs font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Acessando Álbum...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Importar do Link
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Tab 2: HTML Paste Parser */}
              {activeTab === 'html' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Colar Código Fonte (HTML)</h3>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold self-start uppercase">
                    100% à prova de falhas
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Se o link direto falhar devido a bloqueio do Cloudflare, abra a página original no navegador, aperte <kbd className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 border border-slate-800 text-[10px]">Ctrl+U</kbd> para abrir o código fonte, copie tudo e cole no campo abaixo.
                  </p>

                  <div className="bg-indigo-950/25 border border-indigo-900/40 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
                    <span className="text-indigo-400 text-sm mt-0.5">💡</span>
                    <div>
                      <strong className="text-indigo-300">Dica do Clipboard:</strong> Se você estiver usando o aplicativo no visualizador integrado (iframe), o navegador bloqueia a leitura automática do clipboard. <a href={window.location.origin} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold transition inline-flex items-center gap-0.5">Clique aqui para Abrir em Nova Aba ↗</a> para habilitar o botão de colar de 1 clique, ou simplesmente use <kbd className="bg-slate-950 px-1 py-0.5 rounded text-indigo-400 border border-slate-800 text-[10px]">Ctrl+V</kbd> no campo de texto abaixo.
                    </div>
                  </div>

                  {inputUrl && (
                    <div className="bg-slate-950 border border-slate-850/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 mt-1">
                      <div className="text-left w-full sm:w-auto">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5 font-mono">Link de Origem Detetado</span>
                        <p className="text-xs text-slate-300 truncate max-w-xs md:max-w-md">{inputUrl}</p>
                      </div>
                      <a
                        href={inputUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 w-full sm:w-auto"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir Link para Copiar Código
                      </a>
                    </div>
                  )}

                  <div className="space-y-1.5 mt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Nome do Álbum (Opcional)</label>
                    </div>
                    <input
                      type="text"
                      value={customAlbumTitle}
                      onChange={(e) => setCustomAlbumTitle(e.target.value)}
                      placeholder="Ex: Minhas Fotos de Viagem"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Código HTML da Página</label>
                      <button
                        onClick={() => handleAutoPaste(false)}
                        className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border transition-all duration-150 font-bold uppercase cursor-pointer ${
                          clipboardStatus === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : clipboardStatus === 'empty'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : clipboardStatus === 'error'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-indigo-950/40 text-indigo-400 border-indigo-900/50 hover:bg-indigo-900/30 hover:text-indigo-300'
                        }`}
                        title="Colar automaticamente do clipboard"
                      >
                        <Clipboard className="h-3.5 w-3.5" />
                        {clipboardStatus === 'success'
                          ? 'Colado! 🤩'
                          : clipboardStatus === 'empty'
                          ? 'Vazio! 📭'
                          : clipboardStatus === 'error'
                          ? 'Erro ao Colar! ❌'
                          : 'Colar do Clipboard'}
                      </button>
                    </div>
                    <textarea
                      value={pastedHtml}
                      onChange={(e) => setPastedHtml(e.target.value)}
                      placeholder="Cole o código HTML completo aqui..."
                      className="w-full h-32 bg-slate-950 border border-slate-850 rounded-2xl p-4 text-[11px] font-mono text-slate-400 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150 resize-y"
                    ></textarea>
                  </div>

                  <button
                    onClick={() => parseHtmlAndSetAlbum(pastedHtml, customAlbumTitle)}
                    disabled={isLoading || !pastedHtml.trim()}
                    id="btn-parse-html"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3.5 px-4 rounded-2xl shadow flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <FileCode className="h-4 w-4" />
                    Processar Código HTML
                  </button>
                </div>
              )}

              {/* Tab 5: Bookmarklet Auto-Capture */}
              {activeTab === 'bookmarklet' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                    <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Auto-Captura Inteligente</h3>
                  </div>
                  <span className="bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20 px-2.5 py-1 rounded-full font-bold self-start uppercase tracking-wider">
                    Cloudflare Bypass & 100% Automático ⚡
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Evite o trabalho de copiar e colar códigos HTML. Use o nosso <strong>Favorito Inteligente (Bookmarklet)</strong> para enviar qualquer página de álbum diretamente para cá com <strong>apenas 1 clique</strong>!
                  </p>

                  <div className="bg-slate-950 border border-slate-850/80 rounded-2xl p-5 flex flex-col items-center text-center gap-3 mt-1 shadow-inner">
                    <span className="text-2xl animate-bounce">🖱️</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Botão de Instalação</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Arraste o botão abaixo para a sua barra de favoritos do navegador:</p>
                    </div>
                    
                    <a
                      href={getBookmarkletCode()}
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Por favor, ARRASTE este botão para a sua Barra de Favoritos (pressione Ctrl+Shift+B para mostrar a barra no Chrome/Edge).');
                      }}
                      className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-black text-xs px-5 py-3 rounded-xl cursor-grab shadow-lg shadow-amber-500/10 border border-white/10 select-none inline-flex items-center gap-1.5 transition active:scale-[0.98]"
                      title="Arraste para sua barra de favoritos"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                      <span>Capturar Álbum ⚡</span>
                    </a>
                  </div>

                  <div className="space-y-3 mt-2 text-[11px] text-slate-400">
                    <h4 className="font-bold text-slate-300 flex items-center gap-1">
                      <span>📖</span> Como usar em 3 passos simples:
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                      <li>
                        <strong>Instale:</strong> Arraste o botão <strong>"Capturar Álbum ⚡"</strong> para sua Barra de Favoritos (pressione <kbd className="bg-slate-950 px-1 py-0.5 text-[9px] rounded text-slate-300 border border-slate-800">Ctrl+Shift+B</kbd> se a barra não estiver visível).
                      </li>
                      <li>
                        <strong>Navegue:</strong> Abra qualquer álbum no site original (<strong>BAlbums</strong> ou <strong>Bunkr</strong>).
                      </li>
                      <li>
                        <strong>Clique:</strong> Clique no favorito <strong>"Capturar Álbum ⚡"</strong>. Um balão aparecerá confirmando o envio e a página se atualizará aqui instantaneamente!
                      </li>
                    </ol>
                  </div>

                  <div className="border-t border-slate-850 pt-3 flex flex-col gap-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Alternativa Mobile / Manual</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(getBookmarkletCode());
                        alert('Código copiado! Para salvar no celular: \n1. Adicione qualquer página aos favoritos.\n2. Edite o favorito.\n3. Altere o nome para "Capturar Álbum ⚡" e cole este código no campo de URL.');
                      }}
                      className="w-full bg-slate-950 hover:bg-slate-900 text-indigo-400 text-[10px] font-bold py-2.5 px-3 border border-indigo-950 hover:border-indigo-900 rounded-xl transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <Clipboard className="h-3 w-3" />
                      Copiar Código do Favorito
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Saved albums list */}
              {activeTab === 'saved' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-indigo-400" />
                      <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Minha Biblioteca</h3>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-850 font-semibold">
                      {savedAlbums.length} Álbuns
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sua biblioteca local armazena álbuns que você já processou e salvou para download rápido a qualquer momento. Tudo é mantido de forma segura no seu navegador.
                  </p>

                  <div className="space-y-3 mt-2 max-h-[300px] overflow-y-auto pr-1">
                    {savedAlbums.length === 0 ? (
                      <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-500">
                        <FolderOpen className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs font-medium">Nenhum álbum salvo ainda</p>
                        <p className="text-[10px] text-slate-600 mt-1">Carregue um álbum por link ou HTML e clique em "Salvar na Biblioteca"</p>
                      </div>
                    ) : (
                      savedAlbums.map((album) => (
                        <div
                          key={album.id}
                          onClick={() => handleLoadSavedAlbum(album)}
                          className="bg-slate-950/60 hover:bg-indigo-950/20 border border-slate-850 hover:border-indigo-900/40 p-3.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition duration-150"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-indigo-300">
                              {album.title}
                            </h4>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                              <span>{album.itemsCount} arquivos</span>
                              <span>•</span>
                              <span>{album.savedAt}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadSavedAlbum(album);
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600 text-slate-400 hover:text-white transition duration-150"
                              title="Carregar Álbum"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSavedAlbum(album.id, e)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 transition duration-150"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Help instructions */}
              {activeTab === 'help' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Como funciona?</h3>
                  </div>

                  <div className="space-y-4 text-xs text-slate-400 mt-1">
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-mono text-[10px]">1</span>
                        Adicionar Mídias:
                      </h5>
                      <p className="pl-6 leading-relaxed">
                        Você pode colar o link do álbum na aba "Link Direto" ou copiar e colar o código-fonte HTML da página original na aba "Colar Código HTML" se houver bloqueios da CDN externa.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-mono text-[10px]">2</span>
                        Servidor Proxy de CORS:
                      </h5>
                      <p className="pl-6 leading-relaxed">
                        Para conseguir baixar mídias externas no seu navegador sem bloqueios de segurança (CORS), o app utiliza um servidor proxy que encapsula a transferência de mídias para a compilação do arquivo ZIP.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-mono text-[10px]">3</span>
                        Compilação de ZIP:
                      </h5>
                      <p className="pl-6 leading-relaxed">
                        O botão <strong>Baixar Mídias (.zip)</strong> baixa simultaneamente os arquivos selecionados, armazena na memória do navegador usando <strong>JSZip</strong> e inicia o download de um arquivo .zip consolidado de forma ultra rápida.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: History */}
              {activeTab === 'history' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">Histórico de Sessão</h3>
                  </div>
                  {downloadHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-500">Nenhum download registrado nesta sessão.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-1 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {downloadHistory.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-slate-850">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center shrink-0">
                              {item.type === 'video' ? <VideoIcon className="h-4 w-4 text-rose-400" /> : <ImageIcon className="h-4 w-4 text-emerald-400" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-slate-300 truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-500">{item.downloadedAt.toLocaleTimeString()} - {item.size}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                const directUrl = item.url;
                                const finalDownloadUrl = `/api/proxy-media?url=${encodeURIComponent(directUrl)}&download=true&filename=${encodeURIComponent(item.name)}`;
                                const link = document.createElement('a');
                                link.href = finalDownloadUrl;
                                link.download = item.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                              title="Repetir Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                              title="Abrir URL original"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {downloadHistory.length > 0 && (
                     <button
                       onClick={() => setDownloadHistory([])}
                       className="mt-2 text-xs text-slate-500 hover:text-rose-400 font-semibold transition self-start"
                     >
                       Limpar Histórico
                     </button>
                  )}
                </div>
              )}
            </div>

            {/* Active Download Status Panel (shows when active downloading) */}
            {isDownloading && (
              <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-3xl p-6 shadow-xl animate-in fade-in duration-300 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 tracking-wide uppercase flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                    Processando Download
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-200">
                    {downloadedCount} / {totalToDownload} {downloadedCount === totalToDownload ? 'Finalizando' : 'Baixando'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-900">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Iniciando</span>
                    <span>Progresso total: {downloadProgress}%</span>
                    <span>Salvando</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/60">
                  <p className="text-[11px] font-mono text-slate-300 truncate">
                    Status: <span className="text-indigo-300">{downloadStatusText}</span>
                  </p>
                </div>

                {failedDownloads.length > 0 && (
                  <div className="bg-rose-950/20 p-3 rounded-xl border border-rose-900/30">
                    <p className="text-[10px] font-bold text-rose-300">
                      {failedDownloads.length} arquivos falharam.
                    </p>
                    <p className="text-[9px] text-slate-500 mt-1">Eles serão omitidos do ZIP. Você poderá baixá-los individualmente no painel ao lado.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Album Viewer Stage & Files Grid: 7 Cols on LG */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* If no media loaded */}
            {mediaItems.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[450px] relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-indigo-950/10 to-transparent -z-10"></div>
                <div className="bg-slate-950 p-5 rounded-full border border-slate-800 mb-6 text-indigo-400 shadow-inner">
                  <FileArchive className="h-10 w-10 opacity-70 animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-slate-200">Aguardando Importação de Álbum</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Insira um link direto acima ou cole o código fonte HTML de um álbum para começar a extrair mídias, imagens e vídeos.
                </p>

                {/* Example Cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                  <div
                    onClick={() => {
                      setInputUrl('https://balbums.st/a/example');
                      setAlbumTitle('Exemplo de Álbum - Casamento');
                      const simulated: MediaItem[] = [
                        { id: 'ex_1', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800', name: 'foto_casamento_01.jpg', type: 'image', size: '2.4 MB', isResolved: true, thumbnailUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=200' },
                        { id: 'ex_2', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800', name: 'foto_casamento_02.jpg', type: 'image', size: '3.1 MB', isResolved: true, thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=200' },
                        { id: 'ex_3', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', name: 'video_cerimonia.mp4', type: 'video', size: '15.2 MB', isResolved: true }
                      ];
                      setMediaItems(simulated);
                      setSelectedIds(new Set(simulated.map(s => s.id)));
                    }}
                    className="bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl cursor-pointer text-left transition duration-150 group"
                  >
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Demonstração</span>
                    <h5 className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">Carregar Álbum de Exemplo</h5>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">Carrega dados de teste simulados para explorar a interface e testar o gerador de ZIP.</p>
                  </div>

                  <div
                    onClick={() => setActiveTab('help')}
                    className="bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl cursor-pointer text-left transition duration-150 group"
                  >
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block mb-1">Instruções</span>
                    <h5 className="text-xs font-bold text-slate-300 group-hover:text-violet-300 transition-colors">Guia de Uso Rápido</h5>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">Saiba como inspecionar e copiar o código HTML caso precise contornar o Cloudflare.</p>
                  </div>
                </div>
              </div>
            ) : (
              
              /* Viewer Stage - Album Loaded */
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                {/* Album Header card */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-violet-600/5 rounded-full blur-3xl -z-10"></div>
                  
                  {/* Title & Actions bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setViewMode('search')}
                        className="mb-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-indigo-400 text-[10.5px] font-bold py-1.5 px-3 rounded-xl border border-slate-800 hover:border-indigo-900/30 flex items-center gap-1 self-start transition duration-150 cursor-pointer"
                      >
                        ← Voltar para a Busca
                      </button>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">ÁLBUM ATIVO</span>
                      <h2 className="text-lg font-extrabold text-slate-100 truncate pr-4">
                        {albumTitle}
                      </h2>
                      {albumSourceUrl && (
                        <a
                          href={albumSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 mt-1 font-medium"
                        >
                          Link Original <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Library save button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleSaveAlbumToLibrary}
                        className="bg-slate-950/80 hover:bg-indigo-950/50 text-indigo-300 hover:text-indigo-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-850 hover:border-indigo-900/40 flex items-center gap-1.5 transition duration-150"
                      >
                        <Heart className="h-3.5 w-3.5 text-indigo-400" />
                        Salvar na Biblioteca
                      </button>
                    </div>
                  </div>

                  {/* Statistics counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850/60 text-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Arquivos</span>
                      <span className="text-sm font-bold text-slate-200 mt-1 block">{stats.total}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Vídeos</span>
                      <span className="text-sm font-bold text-indigo-400 mt-1 block">{stats.videos}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Imagens</span>
                      <span className="text-sm font-bold text-purple-400 mt-1 block">{stats.images}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Selecionados</span>
                      <span className="text-sm font-bold text-emerald-400 mt-1 block">
                        {selectedIds.size} / {stats.total}
                      </span>
                    </div>
                  </div>

                  {/* Core Download Hub Trigger */}
                  <div className="flex flex-col gap-3 mt-1 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                      <button
                        onClick={handleDownloadAllIndividual}
                        disabled={isDownloading || selectedIds.size === 0}
                        id="btn-download-all-individual"
                        className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 active:scale-[0.99] text-white font-extrabold text-xs md:text-sm py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:pointer-events-none"
                        title="Baixa os arquivos um de cada vez pelo gerenciador de downloads do navegador. Não trava o navegador e suporta vídeos pesados!"
                      >
                        <Download className="h-4 w-4 animate-bounce" />
                        Baixar em Lote
                      </button>

                      <button
                        onClick={handleDownloadAll}
                        disabled={isDownloading || selectedIds.size === 0}
                        id="btn-download-all-zip"
                        className="w-full bg-slate-900 hover:bg-slate-850 active:scale-[0.99] text-slate-200 hover:text-white font-bold text-xs md:text-sm py-3.5 px-5 rounded-2xl border border-slate-800 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:pointer-events-none"
                        title="Compacta todos os selecionados em um único arquivo .zip (Recomendado apenas para imagens ou poucos arquivos pequenos)."
                      >
                        <FileArchive className="h-4 w-4" />
                        Baixar (.zip)
                      </button>

                      <button
                        onClick={handleExportUrls}
                        disabled={isDownloading || selectedIds.size === 0}
                        id="btn-export-urls"
                        className="w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 hover:text-white font-bold text-xs md:text-sm py-3.5 px-5 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:pointer-events-none"
                        title="Exporta os links diretos para um arquivo .txt (ideal para JDownloader)."
                      >
                        <FileText className="h-4 w-4" />
                        Exportar URLs (.txt)
                      </button>
                    </div>

                    {mediaItems.length > 0 && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setMediaItems([])}
                          className="text-slate-500 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition duration-150"
                        >
                          Limpar Álbum
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filters, search and Selection Management */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                  
                  {/* Row 1: Search and Media Type filters */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                      {/* Search by filename */}
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar por termos (ex: aula mp4, foto_01)..."
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 p-0.5 rounded-md hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition"
                            title="Limpar busca"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Type Filter Buttons */}
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                        <button
                          onClick={() => setTypeFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            typeFilter === 'all' ? 'bg-indigo-600/25 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Tudo
                        </button>
                        <button
                          onClick={() => setTypeFilter('video')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            typeFilter === 'video' ? 'bg-indigo-600/25 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <VideoIcon className="h-3.5 w-3.5" />
                          Vídeos
                        </button>
                        <button
                          onClick={() => setTypeFilter('image')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            typeFilter === 'image' ? 'bg-indigo-600/25 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Fotos
                        </button>
                      </div>
                    </div>

                    {/* Selection modifiers */}
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <button
                        onClick={handleSelectAll}
                        className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-850 transition duration-150"
                      >
                        Selecionar Tudo
                      </button>
                      <button
                        onClick={handleSelectNone}
                        className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-850 transition duration-150"
                      >
                        Deselecionar
                      </button>
                      <button
                        onClick={handleInvertSelection}
                        className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-850 transition duration-150"
                        title="Inverter Seleção"
                      >
                        Inverter
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Active suggestions or search stats */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-850/60">
                    {/* Size Filter */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider hidden sm:inline-block mr-1">Tamanho (MB):</span>
                      <input
                        type="number"
                        placeholder="Mín"
                        value={minSizeMB}
                        onChange={(e) => setMinSizeMB(e.target.value)}
                        min="0"
                        className="w-16 bg-slate-950 border border-slate-850 rounded-lg py-1 px-2 text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150"
                      />
                      <span className="text-slate-600 text-xs">-</span>
                      <input
                        type="number"
                        placeholder="Máx"
                        value={maxSizeMB}
                        onChange={(e) => setMaxSizeMB(e.target.value)}
                        min="0"
                        className="w-16 bg-slate-950 border border-slate-850 rounded-lg py-1 px-2 text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150"
                      />
                      {(minSizeMB || maxSizeMB) && (
                        <button
                          onClick={() => { setMinSizeMB(''); setMaxSizeMB(''); }}
                          className="p-1 rounded-md hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition"
                          title="Limpar filtro de tamanho"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Dynamic Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mr-1">Filtrar por Termos Rápidos:</span>
                      
                      {/* Extensions chips */}
                      {getSearchSuggestions().extensions.map(ext => {
                        const isSelected = searchQuery.toLowerCase().includes(ext);
                        return (
                          <button
                            key={ext}
                            onClick={() => {
                              const regex = new RegExp(`\\b${ext}\\b`, 'gi');
                              if (isSelected) {
                                setSearchQuery(prev => prev.replace(regex, '').replace(/\s+/g, ' ').trim());
                              } else {
                                setSearchQuery(prev => prev ? `${prev} ${ext}` : ext);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all duration-150 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-950 hover:bg-indigo-950/40 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-indigo-900/30'
                            }`}
                          >
                            .{ext}
                          </button>
                        );
                      })}

                      {/* Common words chips */}
                      {getSearchSuggestions().words.map(word => {
                        const isSelected = searchQuery.toLowerCase().includes(word);
                        return (
                          <button
                            key={word}
                            onClick={() => {
                              const regex = new RegExp(`\\b${word}\\b`, 'gi');
                              if (isSelected) {
                                setSearchQuery(prev => prev.replace(regex, '').replace(/\s+/g, ' ').trim());
                              } else {
                                setSearchQuery(prev => prev ? `${prev} ${word}` : word);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 ${
                              isSelected
                                ? 'bg-violet-600 text-white border-violet-500'
                                : 'bg-slate-950 hover:bg-violet-950/40 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-violet-900/30'
                            }`}
                          >
                            {word}
                          </button>
                        );
                      })}

                      {getSearchSuggestions().extensions.length === 0 && getSearchSuggestions().words.length === 0 && (
                        <span className="text-[11px] text-slate-600 italic">Carregue um álbum para ver termos sugeridos</span>
                      )}
                    </div>

                    {/* Filter results match counter */}
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Mostrando <strong className="text-indigo-400">{getFilteredItems().length}</strong> de <strong className="text-slate-300">{mediaItems.length}</strong> arquivos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Media grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {getFilteredItems().length === 0 ? (
                    <div className="col-span-full border border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-600">
                      <SlidersHorizontal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium">Nenhum arquivo corresponde aos filtros</p>
                      <p className="text-[10px] mt-1">Limpe sua busca ou altere o tipo de filtro.</p>
                    </div>
                  ) : (
                    getFilteredItems().map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`group bg-slate-900/30 hover:bg-slate-900 border rounded-2xl overflow-hidden shadow-md flex flex-col relative transition-all duration-300 ${
                            isSelected ? 'border-indigo-500/50 bg-indigo-950/5' : 'border-slate-850'
                          }`}
                        >
                          {/* Selection Checkbox Trigger Top Left */}
                          <button
                            onClick={() => handleToggleSelect(item.id)}
                            className="absolute top-2.5 left-2.5 z-10 p-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800 text-indigo-400 transition"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-400 fill-indigo-400/20" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600" />
                            )}
                          </button>

                          {/* Media Type Floating Tag Top Right */}
                          <div className="absolute top-2.5 right-2.5 z-10 flex gap-1">
                            {item.type === 'video' ? (
                              <span className="bg-slate-950/80 backdrop-blur-sm text-indigo-300 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 shadow">
                                <VideoIcon className="h-2.5 w-2.5" />
                                Vídeo
                              </span>
                            ) : item.type === 'image' ? (
                              <span className="bg-slate-950/80 backdrop-blur-sm text-purple-300 border border-purple-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 shadow">
                                <ImageIcon className="h-2.5 w-2.5" />
                                Imagem
                              </span>
                            ) : (
                              <span className="bg-slate-950/80 backdrop-blur-sm text-slate-300 border border-slate-800 text-[9px] px-2 py-0.5 rounded-lg font-bold shadow">
                                Outro
                              </span>
                            )}
                          </div>

                          {/* Preview stage */}
                          <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                                loading="lazy"
                              />
                            ) : (
                              <div className="text-slate-800 flex flex-col items-center">
                                {item.type === 'video' ? (
                                  <VideoIcon className="h-8 w-8 text-indigo-900/40" />
                                ) : (
                                  <ImageIcon className="h-8 w-8 text-purple-900/40" />
                                )}
                              </div>
                            )}

                            {/* Lightbox action hover mask */}
                            <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2.5 transition-opacity duration-200">
                              <button
                                onClick={() => setPreviewMedia(item)}
                                className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-transform hover:scale-110 duration-150"
                                title="Visualizar Mídia"
                              >
                                <Eye className="h-4.5 w-4.5" />
                              </button>
                              <button
                                onClick={() => handleDownloadSingle(item)}
                                className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-100 shadow transition-transform hover:scale-110 duration-150"
                                title="Download Direto"
                              >
                                <Download className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </div>

                          {/* Footer Info section */}
                          <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold text-slate-300 block truncate" title={item.name}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-slate-500 font-mono">
                                  Tam: {cleanSize(item.size)}
                                </span>
                                {!item.isResolved && (
                                  <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1 py-0.2 rounded border border-amber-500/10 font-bold uppercase">
                                    Requer resolução
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions panel */}
                            <div className="flex gap-1.5 pt-1.5 border-t border-slate-850 mt-auto">
                              <button
                                onClick={() => setPreviewMedia(item)}
                                className="flex-1 bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-slate-850 transition flex items-center justify-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                Visualizar
                              </button>
                              <button
                                onClick={() => handleDownloadSingle(item)}
                                className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-[10px] font-bold py-1.5 px-2.5 rounded-lg border border-indigo-500/10 transition flex items-center justify-center"
                                title="Baixar Arquivo"
                              >
                                <Download className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Lightbox Modal (For viewing and playing media in-app) */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => { setPreviewMedia(null); setVideoPlaying(false); }}></div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full flex flex-col relative z-10 shadow-2xl overflow-hidden max-h-[90vh]">
            
            {/* Modal header */}
            <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-900/80 backdrop-blur">
              <div className="min-w-0 flex-1 pr-4">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Visualizador de Mídia</span>
                <h3 className="text-xs font-bold text-slate-100 truncate">{previewMedia.name}</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingle(previewMedia)}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 transition duration-150"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setPreviewMedia(null); setVideoPlaying(false); }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Media Body */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 min-h-[300px] overflow-hidden">
              
              {/* IMAGE PREVIEW */}
              {previewMedia.type === 'image' && (
                <div className="relative max-h-[60vh] max-w-full group">
                  <img
                    src={previewMedia.thumbnailUrl || previewMedia.url}
                    alt={previewMedia.name}
                    className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl border border-slate-850 animate-in zoom-in-95 duration-250"
                  />
                </div>
              )}

              {/* VIDEO PREVIEW (Streaming with CORS Proxy built-in!) */}
              {previewMedia.type === 'video' && (
                <div className="relative max-h-[60vh] w-full max-w-2xl flex flex-col justify-center items-center">
                  <video
                    ref={videoRef}
                    src={getProxyMediaUrl(previewMedia.url)}
                    className="max-h-[55vh] max-w-full rounded-2xl border border-slate-850 shadow-2xl bg-black"
                    controls
                    autoPlay
                    muted={videoMuted}
                    onPlay={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                  />
                  
                  {/* Custom Controls panel for premium feeling */}
                  <div className="flex items-center gap-4 bg-slate-900/90 py-2 px-4 rounded-xl border border-slate-800 shadow mt-3 w-auto">
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (videoPlaying) {
                            videoRef.current.pause();
                          } else {
                            videoRef.current.play();
                          }
                        }
                      }}
                      className="text-slate-200 hover:text-white transition"
                    >
                      {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={() => setVideoMuted(!videoMuted)}
                      className="text-slate-200 hover:text-white transition"
                    >
                      {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>

                    <span className="text-[10px] font-mono text-slate-400">
                      Via Streaming Proxy CORS
                    </span>
                  </div>
                </div>
              )}

              {/* OTHER FORMATS */}
              {previewMedia.type === 'other' && (
                <div className="text-center p-8 flex flex-col items-center">
                  <FileCode className="h-14 w-14 text-slate-800 mb-4" />
                  <p className="text-xs text-slate-400">Este formato de arquivo não possui pré-visualização em tempo real.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Por favor, clique no botão de download para salvá-lo localmente.</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-slate-850 bg-slate-900/60 backdrop-blur text-center flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="text-[10px] text-slate-500 font-medium">
                URL de Origem: {previewMedia.url.substring(0, 60)}...
              </span>
              <button
                onClick={() => handleDownloadSingle(previewMedia)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow flex items-center justify-center gap-2 transition duration-150"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar esta Mídia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-slate-600">
            <strong>BAlbums Pro</strong> - Desenvolvido para facilitar o acesso livre a conteúdos salvos em álbuns digitais e bunkr.
          </p>
          <p className="text-[10px] text-slate-700">
            Todos os downloads são gerenciados inteiramente no navegador do cliente através de um proxy seguro. Não armazenamos seus links nem arquivos.
          </p>
        </div>
      </footer>
    </div>
  );
}
