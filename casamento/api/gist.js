// api/gist.js
export default async function handler(req, res) {
    // CORS e sem cache para funcionar em qualquer celular/rede
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GIST_ID = '587d4828137c2547940d03c72523951b';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const FILE_NAME = 'wedding-data.json';

    if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN não configurado');
        return res.status(500).json({
            error: 'Token não configurado no servidor'
        });
    }

    const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

    const defaultData = {
        guests: [],
        gifts: []
    };

    function normalizeData(data) {
        return {
            guests: Array.isArray(data?.guests) ? data.guests : [],
            gifts: Array.isArray(data?.gifts)
                ? data.gifts
                : (Array.isArray(data?.presentes) ? data.presentes : [])
        };
    }

    async function githubFetch(options = {}) {
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

    try {
        if (req.method === 'GET') {
            const response = await githubFetch({
                method: 'GET'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub GET error:', response.status, errorText);

                return res.status(response.status).json({
                    error: `GitHub API error: ${response.status}`
                });
            }

            const gist = await response.json();
            const content = gist.files?.[FILE_NAME]?.content;

            if (!content) {
                const createResponse = await githubFetch({
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: {
                            [FILE_NAME]: {
                                content: JSON.stringify(defaultData, null, 2)
                            }
                        }
                    })
                });

                if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    console.error('GitHub CREATE error:', createResponse.status, errorText);

                    return res.status(500).json({
                        error: 'Não foi possível criar wedding-data.json'
                    });
                }

                return res.status(200).json(defaultData);
            }

            try {
                const parsed = JSON.parse(content);
                return res.status(200).json(normalizeData(parsed));
            } catch (parseError) {
                console.error('JSON inválido no Gist:', parseError);

                return res.status(500).json({
                    error: 'O arquivo wedding-data.json está com JSON inválido'
                });
            }
        }

        if (req.method === 'POST') {
            const newData = normalizeData(req.body);

            const response = await githubFetch({
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        [FILE_NAME]: {
                            content: JSON.stringify(newData, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub PATCH error:', response.status, errorText);

                return res.status(response.status).json({
                    error: `GitHub API error: ${response.status}`
                });
            }

            return res.status(200).json({
                success: true,
                data: newData
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
