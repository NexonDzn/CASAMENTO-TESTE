// api/gist.js
export default async function handler(req, res) {
    // CORS + sem cache para o conteúdo atualizar em qualquer celular/rede
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GIST_ID = '587d4828137c2547940d03c72523951b';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const FILE_NAME = 'wedding-data.json';
    const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

    if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN não configurado');
        return res.status(500).json({
            error: 'GITHUB_TOKEN não configurado na Vercel'
        });
    }

    const emptyData = {
        guests: [],
        gifts: []
    };

    function safeParseJson(value) {
        if (!value) return null;

        if (typeof value === 'object') return value;

        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function normalizeData(data, fallback = emptyData) {
        const parsed = safeParseJson(data) || {};

        return {
            guests: Array.isArray(parsed.guests)
                ? parsed.guests
                : (Array.isArray(fallback.guests) ? fallback.guests : []),

            gifts: Array.isArray(parsed.gifts)
                ? parsed.gifts
                : (
                    Array.isArray(parsed.presentes)
                        ? parsed.presentes
                        : (Array.isArray(fallback.gifts) ? fallback.gifts : [])
                )
        };
    }

    async function githubApiFetch(options = {}) {
        return fetch(GIST_API_URL, {
            ...options,
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(options.headers || {})
            }
        });
    }

    async function readRawUrl(rawUrl) {
        const rawResponse = await fetch(`${rawUrl}${rawUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/json,text/plain,*/*'
            }
        });

        if (!rawResponse.ok) {
            const errorText = await rawResponse.text().catch(() => '');
            throw new Error(`Erro ao ler raw_url do Gist: ${rawResponse.status} ${errorText}`);
        }

        return rawResponse.text();
    }

    async function getGistFileData() {
        const response = await githubApiFetch({ method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('GitHub GET error:', response.status, errorText);
            throw new Error(`GitHub API error GET: ${response.status}`);
        }

        const gist = await response.json();
        const file = gist.files?.[FILE_NAME];

        if (!file) {
            return {
                exists: false,
                data: emptyData,
                file: null
            };
        }

        let content = file.content || '';
        let parsed = safeParseJson(content);

        // IMPORTANTE:
        // Quando wedding-data.json fica grande por causa de fotos em base64,
        // a API do GitHub pode devolver o campo content truncado.
        // Nesse caso é obrigatório ler pelo raw_url.
        if ((!parsed || file.truncated) && file.raw_url) {
            content = await readRawUrl(file.raw_url);
            parsed = safeParseJson(content);
        }

        if (!parsed) {
            throw new Error('wedding-data.json está com JSON inválido ou truncado');
        }

        return {
            exists: true,
            data: normalizeData(parsed),
            file
        };
    }

    async function saveGistFile(data) {
        const normalized = normalizeData(data);

        const response = await githubApiFetch({
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [FILE_NAME]: {
                        content: JSON.stringify(normalized, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('GitHub PATCH error:', response.status, errorText);
            throw new Error(`GitHub API error PATCH: ${response.status} ${errorText}`);
        }

        return normalized;
    }

    try {
        if (req.method === 'GET') {
            const current = await getGistFileData();

            if (!current.exists) {
                const created = await saveGistFile(emptyData);
                return res.status(200).json(created);
            }

            if (req.query?.debug === '1') {
                return res.status(200).json({
                    ok: true,
                    file: FILE_NAME,
                    giftsCount: current.data.gifts.length,
                    guestsCount: current.data.guests.length,
                    fileSize: current.file?.size || null,
                    truncated: Boolean(current.file?.truncated),
                    data: current.data
                });
            }

            return res.status(200).json(current.data);
        }

        if (req.method === 'POST') {
            const bodyData = safeParseJson(req.body) || {};

            // Mantém o que já existe caso algum POST envie só guests ou só gifts.
            let existing = emptyData;
            try {
                const current = await getGistFileData();
                existing = current.data;
            } catch (error) {
                console.warn('Não foi possível ler dados antigos antes de salvar:', error.message);
            }

            const dataToSave = {
                guests: Array.isArray(bodyData.guests) ? bodyData.guests : existing.guests,
                gifts: Array.isArray(bodyData.gifts)
                    ? bodyData.gifts
                    : (Array.isArray(bodyData.presentes) ? bodyData.presentes : existing.gifts)
            };

            const saved = await saveGistFile(dataToSave);

            return res.status(200).json({
                success: true,
                data: saved
            });
        }

        return res.status(405).json({
            error: 'Método não permitido'
        });

    } catch (err) {
        console.error('API route error:', err);
        return res.status(500).json({
            error: err.message
        });
    }
}
