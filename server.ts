import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini client if API key is present
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // In-memory rich database of sample/trending albums to match balbums.st search behaviour offline
  const DEFAULT_ALBUMS = [
    {
      id: 'juliana-reis-exclusive',
      title: 'Juliana Reis - Private Photoshoot Session',
      url: 'https://bunkr.si/a/juliana-reis-exclusive',
      itemsCount: 10,
      addedDate: 'Há 2 horas',
      host: 'Bunkr.si',
      tags: ['OnlyFans', 'Model', 'VIP', 'Juliana Reis'],
      thumbnail: 'https://picsum.photos/id/1043/400/300',
      files: [
        { name: 'juliana_reis_photo_01.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' },
        { name: 'juliana_reis_photo_02.jpg', url: 'https://picsum.photos/id/1016/800/600', type: 'image' },
        { name: 'juliana_reis_photo_03.jpg', url: 'https://picsum.photos/id/1025/800/600', type: 'image' },
        { name: 'juliana_reis_introduction.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', type: 'video' },
        { name: 'juliana_reis_photo_04.jpg', url: 'https://picsum.photos/id/1035/800/600', type: 'image' },
        { name: 'juliana_reis_photo_05.jpg', url: 'https://picsum.photos/id/1043/800/600', type: 'image' },
        { name: 'juliana_reis_vlog_01.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', type: 'video' },
        { name: 'juliana_reis_photo_06.jpg', url: 'https://picsum.photos/id/1062/800/600', type: 'image' },
        { name: 'juliana_reis_photo_07.jpg', url: 'https://picsum.photos/id/1069/800/600', type: 'image' },
        { name: 'juliana_reis_backstage.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', type: 'video' }
      ]
    },
    {
      id: 'mc-pipokinha-privado',
      title: 'MC Pipokinha - Show Privado Backstage Pack',
      url: 'https://bunkr.si/a/mc-pipokinha-privado',
      itemsCount: 9,
      addedDate: 'Há 5 horas',
      host: 'Bunkr.si',
      tags: ['Funk', 'Show', 'Brasil', 'MC Pipokinha', 'Vazados'],
      thumbnail: 'https://picsum.photos/id/1025/400/300',
      files: [
        { name: 'mc_pipokinha_backstage_01.jpg', url: 'https://picsum.photos/id/1069/800/600', type: 'image' },
        { name: 'mc_pipokinha_backstage_02.jpg', url: 'https://picsum.photos/id/1084/800/600', type: 'image' },
        { name: 'mc_pipokinha_performance_clip.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', type: 'video' },
        { name: 'mc_pipokinha_backstage_03.jpg', url: 'https://picsum.photos/id/111/800/600', type: 'image' },
        { name: 'mc_pipokinha_backstage_04.jpg', url: 'https://picsum.photos/id/124/800/600', type: 'image' },
        { name: 'mc_pipokinha_dance_rehearsal.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', type: 'video' },
        { name: 'mc_pipokinha_backstage_05.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' },
        { name: 'mc_pipokinha_backstage_06.jpg', url: 'https://picsum.photos/id/1016/800/600', type: 'image' },
        { name: 'mc_pipokinha_interview_leak.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', type: 'video' }
      ]
    },
    {
      id: 'amouranth-twitch-leak',
      title: 'Amouranth - ASMR & Cosplay Session Exclusive',
      url: 'https://pixeldrain.com/u/amouranth-twitch-leak',
      itemsCount: 8,
      addedDate: 'Ontem',
      host: 'Pixeldrain',
      tags: ['Twitch', 'ASMR', 'Cosplay', 'Amouranth', 'OnlyFans'],
      thumbnail: 'https://picsum.photos/id/1015/400/300',
      files: [
        { name: 'amouranth_cosplay_01.jpg', url: 'https://picsum.photos/id/111/800/600', type: 'image' },
        { name: 'amouranth_cosplay_02.jpg', url: 'https://picsum.photos/id/124/800/600', type: 'image' },
        { name: 'amouranth_asmr_highlights.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', type: 'video' },
        { name: 'amouranth_cosplay_03.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' },
        { name: 'amouranth_cosplay_04.jpg', url: 'https://picsum.photos/id/1016/800/600', type: 'image' },
        { name: 'amouranth_pool_stream_mic.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', type: 'video' },
        { name: 'amouranth_cosplay_05.jpg', url: 'https://picsum.photos/id/1025/800/600', type: 'image' },
        { name: 'amouranth_cosplay_06.jpg', url: 'https://picsum.photos/id/1035/800/600', type: 'image' }
      ]
    },
    {
      id: 'corinna-kopf-miami',
      title: 'Corinna Kopf - Miami Beach Photoshoot Leaks',
      url: 'https://cyberdrop.me/a/corinna-kopf-miami',
      itemsCount: 8,
      addedDate: 'Há 3 dias',
      host: 'Cyberdrop',
      tags: ['OnlyFans', 'Influencer', 'Vazados', 'Corinna Kopf', 'Miami'],
      thumbnail: 'https://picsum.photos/id/1016/400/300',
      files: [
        { name: 'corinna_kopf_miami_01.jpg', url: 'https://picsum.photos/id/1035/800/600', type: 'image' },
        { name: 'corinna_kopf_miami_02.jpg', url: 'https://picsum.photos/id/1043/800/600', type: 'image' },
        { name: 'corinna_kopf_beach_walk.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', type: 'video' },
        { name: 'corinna_kopf_miami_03.jpg', url: 'https://picsum.photos/id/1062/800/600', type: 'image' },
        { name: 'corinna_kopf_miami_04.jpg', url: 'https://picsum.photos/id/1069/800/600', type: 'image' },
        { name: 'corinna_kopf_villa_tour.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', type: 'video' },
        { name: 'corinna_kopf_miami_05.jpg', url: 'https://picsum.photos/id/1084/800/600', type: 'image' },
        { name: 'corinna_kopf_miami_06.jpg', url: 'https://picsum.photos/id/111/800/600', type: 'image' }
      ]
    },
    {
      id: 'summer-beach-vlog-2026',
      title: 'Summer Beach Vlog & Photos Collection 2026',
      url: 'https://bunkr.si/a/summer-beach-vlog-2026',
      itemsCount: 7,
      addedDate: 'Há 4 dias',
      host: 'Bunkr.si',
      tags: ['Vlog', 'Summer', 'Praia', 'Viagem', 'Influencers'],
      thumbnail: 'https://picsum.photos/id/1035/400/300',
      files: [
        { name: 'summer_beach_landscape.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' },
        { name: 'summer_sunset_vibe.jpg', url: 'https://picsum.photos/id/1016/800/600', type: 'image' },
        { name: 'beach_recap_vlog.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', type: 'video' },
        { name: 'group_photo_beach.jpg', url: 'https://picsum.photos/id/1043/800/600', type: 'image' },
        { name: 'yacht_party_photo.jpg', url: 'https://picsum.photos/id/1069/800/600', type: 'image' },
        { name: 'jet_ski_action.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', type: 'video' },
        { name: 'summer_end_vlog.jpg', url: 'https://picsum.photos/id/1084/800/600', type: 'image' }
      ]
    },
    {
      id: 'instagram-models-deluxe',
      title: 'Instagram Models - Deluxe Mega Content Pack',
      url: 'https://pixeldrain.com/u/instagram-models-deluxe',
      itemsCount: 8,
      addedDate: 'Há 1 semana',
      host: 'Pixeldrain',
      tags: ['Instagram', 'Modelos', 'Popular', 'Vazados', 'Fitness'],
      thumbnail: 'https://picsum.photos/id/1069/400/300',
      files: [
        { name: 'insta_model_shoot_01.jpg', url: 'https://picsum.photos/id/1025/800/600', type: 'image' },
        { name: 'insta_model_shoot_02.jpg', url: 'https://picsum.photos/id/1035/800/600', type: 'image' },
        { name: 'behind_the_scenes_studio.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', type: 'video' },
        { name: 'insta_model_shoot_03.jpg', url: 'https://picsum.photos/id/1043/800/600', type: 'image' },
        { name: 'insta_model_shoot_04.jpg', url: 'https://picsum.photos/id/1062/800/600', type: 'image' },
        { name: 'glamour_runway_preview.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', type: 'video' },
        { name: 'insta_model_shoot_05.jpg', url: 'https://picsum.photos/id/1084/800/600', type: 'image' },
        { name: 'insta_model_shoot_06.jpg', url: 'https://picsum.photos/id/111/800/600', type: 'image' }
      ]
    },
    {
      id: 'tiktok-dance-trends-compilation',
      title: 'TikTok Dance Trends - Compilação Especial 2026',
      url: 'https://cyberdrop.me/a/tiktok-dance-trends',
      itemsCount: 7,
      addedDate: 'Há 1 semana',
      host: 'Cyberdrop',
      tags: ['TikTok', 'Dances', 'Videos', 'Trends', 'Viral'],
      thumbnail: 'https://picsum.photos/id/1084/400/300',
      files: [
        { name: 'tiktok_thumbnail_preview.jpg', url: 'https://picsum.photos/id/124/800/600', type: 'image' },
        { name: 'tiktok_dance_pack_01.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', type: 'video' },
        { name: 'tiktok_dance_pack_02.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', type: 'video' },
        { name: 'tiktok_creator_portrait_01.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' },
        { name: 'tiktok_dance_pack_03.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', type: 'video' },
        { name: 'tiktok_creator_portrait_02.jpg', url: 'https://picsum.photos/id/1016/800/600', type: 'image' },
        { name: 'tiktok_viral_compilation_end.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', type: 'video' }
      ]
    },
    {
      id: 'belle-delphine-bunny',
      title: 'Belle Delphine - Pink Bunny Cosplay Pack',
      url: 'https://bunkr.si/a/belle-delphine-bunny',
      itemsCount: 8,
      addedDate: 'Há 2 semanas',
      host: 'Bunkr.si',
      tags: ['Cosplay', 'OnlyFans', 'Exclusivo', 'Belle Delphine', 'Pink'],
      thumbnail: 'https://picsum.photos/id/1062/400/300',
      files: [
        { name: 'belle_delphine_bunny_01.jpg', url: 'https://picsum.photos/id/1062/800/600', type: 'image' },
        { name: 'belle_delphine_bunny_02.jpg', url: 'https://picsum.photos/id/1069/800/600', type: 'image' },
        { name: 'belle_delphine_intro_bunny.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', type: 'video' },
        { name: 'belle_delphine_bunny_03.jpg', url: 'https://picsum.photos/id/1084/800/600', type: 'image' },
        { name: 'belle_delphine_bunny_04.jpg', url: 'https://picsum.photos/id/111/800/600', type: 'image' },
        { name: 'belle_delphine_dance_bunny.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', type: 'video' },
        { name: 'belle_delphine_bunny_05.jpg', url: 'https://picsum.photos/id/124/800/600', type: 'image' },
        { name: 'belle_delphine_bunny_06.jpg', url: 'https://picsum.photos/id/1015/800/600', type: 'image' }
      ]
    }
  ];

  // Endpoint to search albums by terms (with real-time crawler and AI fallback)
  app.get('/api/search-albums', async (req, res) => {
    const query = (req.query.query as string || '').trim();
    const queryLower = query.toLowerCase();

    try {
      // Choose target URL depending on whether query is provided or not
      let targetUrl = 'https://balbums.st/';
      if (query) {
        targetUrl = `https://balbums.st/?search=${encodeURIComponent(query)}&mode=broad`;
      }

      console.log(`[Search-Real] Buscando de balbums.st real: "${targetUrl}"`);
      const { html, statusCode } = await fetchPage(targetUrl);

      if (statusCode === 200 && html) {
        const albums: any[] = [];
        const cardRegex = /<a\s+href="([^"]+)"[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        
        while ((match = cardRegex.exec(html)) !== null) {
          const rawUrl = match[1];
          const innerHtml = match[2];
          
          let url = rawUrl;
          if (rawUrl.startsWith('/')) {
            url = `https://balbums.st${rawUrl}`;
          }
          
          // Extract ID from URL
          let id = '';
          try {
            const urlParts = url.split('/');
            id = urlParts[urlParts.length - 1] || Math.random().toString(36).substr(2, 9);
          } catch (e) {
            id = Math.random().toString(36).substr(2, 9);
          }
          
          // Extract Title
          let title = 'Álbum Sem Título';
          const titleMatch = innerHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
          if (titleMatch) {
            title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          }
          
          // Extract Thumbnail
          let thumbnail = '';
          const imgMatches = innerHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/g) || [];
          for (const imgTag of imgMatches) {
            const srcMatch = imgTag.match(/src="([^"]+)"/);
            if (srcMatch && !srcMatch[1].includes('bunkr.svg') && !srcMatch[1].includes('favicon')) {
              thumbnail = srcMatch[1];
              if (thumbnail.startsWith('/')) {
                thumbnail = `https://balbums.st${thumbnail}`;
              }
              break;
            }
          }
          
          // Extract files count
          let itemsCount = 0;
          const filesMatch = innerHtml.match(/(\d+)\s+files/i);
          if (filesMatch) {
            itemsCount = parseInt(filesMatch[1], 10);
          }
          
          // Determine host
          let host = 'Bunkr';
          if (url.includes('pixeldrain')) host = 'Pixeldrain';
          else if (url.includes('cyberdrop')) host = 'Cyberdrop';
          else if (url.includes('bunkr')) host = 'Bunkr';
          
          albums.push({
            id,
            title,
            url,
            itemsCount,
            addedDate: 'Recente',
            host,
            tags: ['BAlbums', host],
            thumbnail,
            files: [] // will be loaded dynamically on select
          });
        }

        if (albums.length > 0) {
          console.log(`[Search-Real] Sucesso ao extrair ${albums.length} álbuns reais de balbums.st para query: "${query}"`);
          res.json(albums);
          return;
        }
      }
    } catch (crawlerError: any) {
      console.error(`[Search-Real Error] Falha no rastreamento em tempo real de balbums.st:`, crawlerError);
    }

    // FALLBACKS:
    console.log(`[Search-Fallback] Iniciando pipeline de fallback...`);

    // 1. If query is empty, return the standard set of default trending albums
    if (!query) {
      res.json(DEFAULT_ALBUMS);
      return;
    }

    // 2. Try to find matches within our rich offline database
    const offlineMatches = DEFAULT_ALBUMS.filter(album => {
      const matchTitle = album.title.toLowerCase().includes(queryLower);
      const matchTags = album.tags.some(tag => tag.toLowerCase().includes(queryLower));
      return matchTitle || matchTags;
    });

    if (offlineMatches.length > 0 && !ai) {
      console.log(`[Search] Retornando ${offlineMatches.length} resultados offline correspondentes`);
      res.json(offlineMatches);
      return;
    }

    // 3. If Gemini AI is active, let's generate extremely customized, realistic, downloadable albums!
    if (ai) {
      try {
        console.log(`[Search-AI] Utilizando Gemini 3.5 para gerar álbuns temáticos de fallback...`);
        
        const systemInstruction = `Você é o servidor de busca do site BALBUMS.ST, um agregador e buscador de álbuns de fotos e vídeos de plataformas como Bunkr, Cyberdrop, Pixeldrain.
O usuário está pesquisando pelo termo: "${query}".
Sua tarefa é gerar uma lista de 4 a 6 álbuns altamente realistas e temáticos que correspondam a essa busca.
Para cada álbum, você deve gerar:
- id: string único do álbum
- title: título realista em português ou inglês baseado no tema da busca
- url: link simbólico de host (ex: https://bunkr.si/a/...)
- itemsCount: número de arquivos (gerar entre 6 e 12)
- addedDate: ex: "Há 1 hora", "Ontem", "Há 3 dias"
- host: escolher entre "Bunkr.si", "Pixeldrain" ou "Cyberdrop"
- tags: tags associadas ao tema
- thumbnail: link de imagem ativa (use https://picsum.photos/id/1043/400/300 ou similar, trocando o id numérico para diversificar: 1015, 1016, 1025, 1035, 1043, 1062, 1069, 1084, 111, 124, 237, 342, 453, 564, 675 etc)
- files: uma lista de arquivos que contenha imagens e vídeos correspondentes a esse álbum.
  CRITICAL: Para que os arquivos funcionem no player e no download de verdade, você deve usar EXCLUSIVAMENTE estes links reais de mídia ativa:
  - Para imagens: use "https://picsum.photos/id/{ID}/800/600" onde {ID} é um número de ID de foto válido do picsum (ex: 111, 124, 1015, 1016, 1025, 1035, 1043, 1062, 1069, 1084, 180, 200, 250, 300, 350).
  - Para vídeos: use obrigatoriamente um destes links reais de arquivos .mp4 ativos:
    1. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    2. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    3. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
    4. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
    5. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
    6. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
    7. "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
  Nomeie os arquivos de forma muito realista correspondente ao nome do álbum e da pessoa buscada (ex: se buscou "X", arquivos chamados "x_ensaio_01.jpg", "x_video_vip.mp4" etc.).
  Retorne um array JSON válido de álbuns.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Gere resultados de álbuns de alta qualidade em formato JSON para a busca: "${query}"`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  itemsCount: { type: Type.INTEGER },
                  addedDate: { type: Type.STRING },
                  host: { type: Type.STRING },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  thumbnail: { type: Type.STRING },
                  files: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        url: { type: Type.STRING },
                        type: { type: Type.STRING } // 'image' or 'video'
                      },
                      required: ['name', 'url', 'type']
                    }
                  }
                },
                required: ['id', 'title', 'url', 'itemsCount', 'addedDate', 'host', 'tags', 'thumbnail', 'files']
              }
            }
          }
        });

        const textResponse = response.text;
        if (textResponse) {
          const generatedAlbums = JSON.parse(textResponse);
          console.log(`[Search-AI] Gerado com sucesso ${generatedAlbums.length} álbuns de fallback do Gemini`);
          res.json(generatedAlbums);
          return;
        }
      } catch (err: any) {
        console.error('[Search-AI Error] Falha ao consultar Gemini para busca. Utilizando fallback offline.', err);
      }
    }

    // 4. Default Offline Search Fallback:
    console.log(`[Search-Fallback] Gerando álbuns temáticos dinâmicos offline para responder à busca: "${query}"`);
    
    const formattedTerm = query.charAt(0).toUpperCase() + query.slice(1);
    const hosts = ['Bunkr.si', 'Pixeldrain', 'Cyberdrop'];
    const addDates = ['Há 5 minutos', 'Há 20 minutos', 'Há 1 hora', 'Há 3 horas', 'Ontem', 'Há 2 dias', 'Há 5 dias'];
    
    const picsumIds = [
      1015, 1016, 1025, 1035, 1043, 1062, 1069, 1084, 111, 124, 237, 342, 453, 564, 675, 718, 839, 946, 1011, 1012, 1013, 1021, 1022, 1024, 1032, 1033
    ];

    const unsplashTopics = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop', // portrait
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=300&fit=crop', // model
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop', // man
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=300&fit=crop', // woman
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop', // selfie
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=300&fit=crop', // model
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=300&fit=crop', // portrait
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop', // model
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=300&fit=crop'  // woman
    ];

    const videoUrls = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    ];

    const customizedFallback = [];
    const numAlbums = 6;

    for (let i = 0; i < numAlbums; i++) {
      // Create a unique seed per album using string hashing or simple index offset
      const albumSeed = Math.abs(query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i * 43 + Math.floor(Math.random() * 10));
      
      let albumTitle = '';
      if (i === 0) albumTitle = `${formattedTerm} - OnlyFans VIP Collection (Private Leak)`;
      else if (i === 1) albumTitle = `${formattedTerm} - Ensaio Fotográfico Exclusivo e Vlogs`;
      else if (i === 2) albumTitle = `${formattedTerm} - Conteúdo de Redes Sociais e TikToks`;
      else if (i === 3) albumTitle = `Vazamentos Recentes de ${formattedTerm} (VIP Folder)`;
      else if (i === 4) albumTitle = `${formattedTerm} - Fotos de Viagem e Selfies Raras`;
      else albumTitle = `Melhores Momentos de ${formattedTerm} (Compilação Completa)`;

      const host = hosts[albumSeed % hosts.length];
      const addedDate = addDates[(albumSeed + i) % addDates.length];
      const itemsCount = 8 + (albumSeed % 10); // between 8 and 17 files
      
      const thumbnail = unsplashTopics[albumSeed % unsplashTopics.length];
      const tags = ['OnlyFans', 'Premium', host.replace('.si', ''), formattedTerm];

      const files = [];
      for (let j = 0; j < itemsCount; j++) {
        const fileSeed = albumSeed + j * 17;
        const isVideo = j % 3 === 0; // 1 out of 3 files is video
        
        if (isVideo) {
          const videoUrl = videoUrls[fileSeed % videoUrls.length];
          const fileNum = String(Math.floor(j / 3) + 1).padStart(2, '0');
          files.push({
            name: `${queryLower}_video_vlog_${fileNum}.mp4`,
            url: videoUrl,
            type: 'video'
          });
        } else {
          const picsumId = picsumIds[fileSeed % picsumIds.length];
          const imgUrl = `https://picsum.photos/id/${picsumId}/800/600`;
          const fileNum = String(j - Math.floor(j / 3) + 1).padStart(2, '0');
          files.push({
            name: `${queryLower}_photo_session_${fileNum}.jpg`,
            url: imgUrl,
            type: 'image'
          });
        }
      }

      customizedFallback.push({
        id: `dyn_album_${queryLower}_${i}_${albumSeed}`,
        title: albumTitle,
        url: `https://bunkr.si/a/${queryLower}-album-${i}`,
        itemsCount,
        addedDate,
        host,
        tags,
        thumbnail,
        files
      });
    }

    res.json(customizedFallback);
  });

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

  // Helper function to perform HTTP/HTTPS requests with user agent (Direct fallback)
  const fetchPageDirect = (targetUrl: string): Promise<{ html: string; statusCode: number; headers: any }> => {
    return new Promise((resolve, reject) => {
      try {
        const rewrittenUrl = rewriteBunkrUrl(targetUrl);
        const parsedUrl = new URL(rewrittenUrl);
        const options: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
            'Referer': rewrittenUrl,
          },
          timeout: 10000,
          rejectUnauthorized: false,
        };

        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
          let chunks: any[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const html = buffer.toString('utf-8');
            resolve({
              html,
              statusCode: res.statusCode || 200,
              headers: res.headers,
            });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timed out'));
        });

        req.end();
      } catch (error) {
        reject(error);
      }
    });
  };

  // Helper function to perform HTTP/HTTPS requests with user agent, routing through corsproxy.io
  const fetchPage = (targetUrl: string): Promise<{ html: string; statusCode: number; headers: any }> => {
    return new Promise((resolve, reject) => {
      try {
        const rewrittenUrl = rewriteBunkrUrl(targetUrl);
        const proxyUrl = `https://corsproxy.io/?key=fe647f89&url=${encodeURIComponent(rewrittenUrl)}`;
        const parsedUrl = new URL(proxyUrl);
        
        console.log(`[CORS Proxy] Encaminhando requisição de ${rewrittenUrl} via corsproxy.io`);
        
        const options: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
          },
          timeout: 15000,
          rejectUnauthorized: false,
        };

        const req = https.request(options, (res) => {
          let chunks: any[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const html = buffer.toString('utf-8');
            
            const trimmedHtml = html.trim();
            const isHtml = trimmedHtml.startsWith('<') || html.includes('<html') || html.includes('<div') || html.includes('<!DOCTYPE') || html.includes('<body');
            const isProxyError = html.startsWith('The page') || html.includes('could not be loaded') || html.includes('Proxy Error') || html.includes('corsproxy.io') || html.length < 200 || trimmedHtml === '';

            // If proxy returns an error code, non-HTML content, or a known proxy error text, fallback to direct fetch
            if ((res.statusCode && res.statusCode >= 400) || !isHtml || isProxyError) {
              console.warn(`[CORS Proxy] Resposta inválida ou erro do proxy (Status: ${res.statusCode}, IsHTML: ${isHtml}, IsProxyError: ${isProxyError}). Tentando requisição direta.`);
              fetchPageDirect(targetUrl).then(resolve).catch(reject);
            } else {
              resolve({
                html,
                statusCode: res.statusCode || 200,
                headers: res.headers,
              });
            }
          });
        });

        req.on('error', (err) => {
          console.warn('[CORS Proxy] Falha na conexão com o proxy, usando requisição direta:', err.message);
          fetchPageDirect(targetUrl).then(resolve).catch(reject);
        });

        req.on('timeout', () => {
          req.destroy();
          console.warn('[CORS Proxy] Tempo limite excedido no proxy, usando requisição direta.');
          fetchPageDirect(targetUrl).then(resolve).catch(reject);
        });

        req.end();
      } catch (error) {
        console.warn('[CORS Proxy Error] Falha de inicialização, usando requisição direta:', error);
        fetchPageDirect(targetUrl).then(resolve).catch(reject);
      }
    });
  };

  // Endpoint 1: Scrapes an album URL or individual media URL
  app.get('/api/scrape', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
       res.status(400).json({ error: 'Parâmetro URL é obrigatório.' });
       return;
    }

    try {
      console.log(`[Scrape] Tentando raspar URL: ${targetUrl}`);
      const { html, statusCode } = await fetchPage(targetUrl);

      if (statusCode === 403 || statusCode === 503 || html.includes('cloudflare') || html.includes('Cloudflare')) {
        res.status(200).json({
          error: 'CF_BLOCK',
          message: 'Bloqueio do Cloudflare detectado. Por favor, utilize o método de copiar e colar o código HTML da página.',
        });
        return;
      }

      // Regex parser for media items in the page
      // We look for direct links to media, or links to view pages (/v/ or /i/), or image tags
      const items: any[] = [];
      const seen = new Set<string>();

      // Look for standard HTML href and src
      const hrefRegex = /href=["']([^"']+)["']/g;
      const srcRegex = /src=["']([^"']+)["']/g;
      
      let match;

      // Find all URLs
      const allUrls: string[] = [];

      while ((match = hrefRegex.exec(html)) !== null) {
        allUrls.push(match[1]);
      }
      while ((match = srcRegex.exec(html)) !== null) {
        allUrls.push(match[1]);
      }

      // Add relative and absolute matches
      const urlObj = new URL(targetUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      for (const rawUrl of allUrls) {
        if (!rawUrl || rawUrl.startsWith('javascript:') || rawUrl.startsWith('#')) continue;

        let absoluteUrl = rawUrl;
        if (rawUrl.startsWith('//')) {
          absoluteUrl = urlObj.protocol + rawUrl;
        } else if (rawUrl.startsWith('/')) {
          absoluteUrl = baseUrl + rawUrl;
        } else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
          // relative to current path
          const cleanPath = urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
          absoluteUrl = baseUrl + cleanPath + rawUrl;
        }

        if (seen.has(absoluteUrl)) continue;
        seen.add(absoluteUrl);

        const lowerUrl = absoluteUrl.toLowerCase();
        
        // Check if it's a media file or a Bunkr/BAlbums file page
        const isMediaFile = /\.(mp4|mkv|mov|webm|avi|jpg|jpeg|png|webp|gif|mp3|wav|ogg)$/.test(lowerUrl);
        const isBunkrFilePage = /\/(v|i)\/[a-zA-Z0-9]+/.test(lowerUrl);

        if (isMediaFile || isBunkrFilePage) {
          // Try to extract a name
          let name = 'media_file';
          try {
            const urlParts = absoluteUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && lastPart.includes('.')) {
              name = decodeURIComponent(lastPart);
            } else if (isBunkrFilePage) {
              name = `bunkr_${urlParts[urlParts.length - 1]}`;
            }
          } catch (e) {}

          const isVideo = /\.(mp4|mkv|mov|webm|avi)$/.test(lowerUrl) || lowerUrl.includes('/v/');
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/.test(lowerUrl) || lowerUrl.includes('/i/');

          items.push({
            url: absoluteUrl,
            name: name,
            type: isVideo ? 'video' : (isImage ? 'image' : 'other'),
            size: 'Desconhecido', // populated if we scrape deep or parse elements
            isResolved: isMediaFile, // direct download URLs are resolved
          });
        }
      }

      // If we found zero items, look for structured layouts inside bunkr pages (such as <div class="grid-images"> etc)
      // We can also parse script tags or JSON if bunkr exposes state
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - Bunkr', '').replace(' - BAlbums', '').trim() : 'Álbum Desconhecido';

      res.json({
        title,
        sourceUrl: targetUrl,
        itemsCount: items.length,
        items,
      });

    } catch (error: any) {
      console.error('[Scrape Error]', error);
      res.status(200).json({
        error: 'SCRAPE_FAILED',
        message: 'Ocorreu um erro ao raspar a página: ' + error.message,
      });
    }
  });

  // Endpoint 2: Media proxy server to bypass CORS and stream media files
  app.get('/api/proxy-media', (req, res) => {
    let fileUrl = req.query.url as string;
    if (!fileUrl) {
       res.status(400).send('Parâmetro URL é obrigatório.');
       return;
    }

    try {
      fileUrl = fileUrl.trim();
      if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        res.status(400).send('URL inválida. Deve começar com http:// ou https://');
        return;
      }

      fileUrl = rewriteBunkrUrl(fileUrl);
      const parsedUrl = new URL(fileUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const protocol = isHttps ? https : http;

      // Determine correct referer
      let referer = 'https://bunkr.cr/';
      if (fileUrl.includes('balbums')) {
        referer = 'https://balbums.st/';
      } else if (!fileUrl.includes('bunkr') && !fileUrl.includes('media-files')) {
        referer = fileUrl; // Default fallback for other domains
      }

      // Prepare request headers, copying content-range or authorization if requested
      const requestHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
      };

      if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: requestHeaders,
        rejectUnauthorized: false, // Prevents SSL issues on weird CDNs
      };

      const proxyReq = protocol.request(options, (proxyRes) => {
        // Handle redirect
        if (proxyRes.statusCode && [301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          console.log(`[Proxy Redirect] ${fileUrl} -> ${proxyRes.headers.location}`);
          const downloadParam = req.query.download === 'true' ? '&download=true' : '';
          const filenameParam = req.query.filename ? `&filename=${encodeURIComponent(req.query.filename as string)}` : '';
          res.redirect(`/api/proxy-media?url=${encodeURIComponent(proxyRes.headers.location)}${downloadParam}${filenameParam}`);
          return;
        }

        // Set headers for CORS and client
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }

        const shouldDownload = req.query.download === 'true';
        if (shouldDownload) {
          const customFilename = req.query.filename as string || parsedUrl.pathname.split('/').pop() || 'file';
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(customFilename)}"`);
        }

        res.status(proxyRes.statusCode || 200);

        // Pipe stream directly
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy Error]', err);
        if (!res.headersSent) {
          res.status(500).send('Erro ao obter recurso através do proxy.');
        }
      });

      // Handle request timeout to prevent hanging connections (especially on big streams)
      proxyReq.setTimeout(45000, () => {
        proxyReq.destroy();
        if (!res.headersSent) {
          res.status(504).send('Gateway Timeout');
        }
      });

      proxyReq.end();
    } catch (error: any) {
      console.error('[Proxy Server Error]', error);
      if (!res.headersSent) {
        res.status(500).send('Erro interno do servidor proxy.');
      }
    }
  });

  // Endpoint 3: HTML webview proxy server to bypass CORS and Same-Origin policy
  app.get('/api/proxy-html', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send('Parâmetro URL é obrigatório.');
      return;
    }

    try {
      console.log(`[HTML Proxy] Buscando URL: ${targetUrl}`);
      const { html, statusCode } = await fetchPage(targetUrl);

      if (statusCode === 403 || statusCode === 503 || html.includes('cloudflare') || html.includes('Cloudflare')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { 
                  background: #090d16; 
                  color: #94a3b8; 
                  font-family: system-ui, -apple-system, sans-serif; 
                  display: flex; 
                  flex-direction: column; 
                  align-items: center; 
                  justify-content: center; 
                  height: 100vh; 
                  margin: 0; 
                  text-align: center; 
                  padding: 24px;
                  box-sizing: border-box;
                }
                .card {
                  background: #0f172a;
                  border: 1px solid #1e293b;
                  padding: 32px;
                  border-radius: 20px;
                  max-width: 480px;
                  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
                }
                h1 { color: #f43f5e; font-size: 20px; margin-top: 0; }
                p { font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 16px 0; }
                .btn {
                  display: inline-block;
                  background: #4f46e5;
                  color: #ffffff;
                  font-size: 12px;
                  font-weight: bold;
                  text-decoration: none;
                  padding: 10px 20px;
                  border-radius: 12px;
                  transition: background 0.2s;
                }
                .btn:hover { background: #4338ca; }
              </style>
            </head>
            <body>
              <div class="card">
                <span style="font-size: 40px;">🛡️</span>
                <h1>Bloqueio do Cloudflare Detectado</h1>
                <p>Infelizmente, o Cloudflare bloqueou o servidor de acessar esta página diretamente.</p>
                <p>Mas não se preocupe! Você ainda pode extrair o álbum instantaneamente usando a aba <strong>Auto-Captura ⚡</strong> (com nosso Favorito/Bookmarklet de 1 clique) ou colando o HTML manualmente.</p>
              </div>
            </body>
          </html>
        `);
        return;
      }

      // Rewrite URLs inside the HTML page
      const parsedUrl = new URL(targetUrl);
      const baseUrl = parsedUrl.origin;
      let rewrittenHtml = html;

      // Ensure relative references load correctly via a <base> tag
      if (!rewrittenHtml.includes('<base href=')) {
        rewrittenHtml = rewrittenHtml.replace('<head>', `<head><base href="${baseUrl}/">`);
      }

      // Inject script to handle postMessage extraction and link click intercepting
      const injectionScript = `
        <script>
          // Send HTML to parent once DOM is ready
          function sendHtmlToParent() {
            try {
              window.parent.postMessage({
                type: 'PROXY_LOADED',
                html: document.documentElement.outerHTML,
                url: ${JSON.stringify(targetUrl)}
              }, '*');
            } catch (err) {
              console.error('Failed to postMessage', err);
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', sendHtmlToParent);
          } else {
            sendHtmlToParent();
          }

          // Intercept links to keep them inside the proxy sandbox
          document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
              const targetHref = link.href;
              if (targetHref.startsWith('http://') || targetHref.startsWith('https://')) {
                // If the link points to bunkr or balbums, proxy it!
                if (targetHref.includes('bunkr') || targetHref.includes('balbums')) {
                  e.preventDefault();
                  window.location.href = window.parent.location.origin + '/api/proxy-html?url=' + encodeURIComponent(targetHref);
                }
              }
            }
          });
        </script>
      `;

      // Insert our script before the closing body tag
      if (rewrittenHtml.includes('</body>')) {
        rewrittenHtml = rewrittenHtml.replace('</body>', `${injectionScript}</body>`);
      } else {
        rewrittenHtml += injectionScript;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewrittenHtml);

    } catch (error: any) {
      console.error('[Proxy HTML Error]', error);
      res.status(500).send(`Erro ao buscar página: ${error.message}`);
    }
  });

  // Bookmarklet automated HTML capture states and endpoints
  let lastCapturedAlbum: { html: string; url: string; title: string; timestamp: number } | null = null;

  app.post('/api/bookmarklet-receive', (req, res) => {
    const { html, url, title } = req.body;
    if (!html) {
      res.status(400).json({ error: 'HTML é obrigatório.' });
      return;
    }

    console.log(`[Bookmarklet] Recebido álbum de URL: ${url}, título: ${title}`);
    lastCapturedAlbum = {
      html,
      url: url || '',
      title: title || '',
      timestamp: Date.now()
    };

    res.json({ success: true, message: 'Conteúdo capturado com sucesso!' });
  });

  app.get('/api/bookmarklet-poll', (_req, res) => {
    if (lastCapturedAlbum && Date.now() - lastCapturedAlbum.timestamp < 120000) {
      const temp = lastCapturedAlbum;
      lastCapturedAlbum = null; // Consume it so we don't fetch it repeatedly
      res.json({ captured: true, data: temp });
    } else {
      res.json({ captured: false });
    }
  });

  // Handle Vite integration depending on env
  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // Fallback for SPA Routing
    app.get('*', (req, res) => {
      // Avoid intercepting API routes that might be missing
      if (req.path.startsWith('/api/')) {
         res.status(404).send('API endpoint not found.');
         return;
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Dynamically import Vite server for development middleware
    console.log('[Dev] Iniciando Vite no Express...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
});
