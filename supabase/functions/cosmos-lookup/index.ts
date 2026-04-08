import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { barcode } = await req.json()
    if (!barcode || typeof barcode !== 'string' || barcode.length < 8) {
      return new Response(JSON.stringify({ error: 'Código de barras inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const COSMOS_TOKEN = Deno.env.get('COSMOS_API_TOKEN')
    if (!COSMOS_TOKEN) {
      return new Response(JSON.stringify({ error: 'Token da API Cosmos não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cosmosRes = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${barcode}.json`, {
      headers: {
        'X-Cosmos-Token': COSMOS_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'Lovable-PDV/1.0',
      },
    })

    if (!cosmosRes.ok) {
      const status = cosmosRes.status
      if (status === 404) {
        return new Response(JSON.stringify({ error: 'Produto não encontrado na base Cosmos' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: `Erro na API Cosmos: ${status}` }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await cosmosRes.json()

    // Extract relevant tax/product info
    const result = {
      name: data.description || '',
      descricao: data.description || '',
      barcode: data.gtin?.toString() || barcode,
      ncm: data.ncm?.code || '',
      ncm_descricao: data.ncm?.description || '',
      cest: data.cest?.code || '',
      price: data.avg_price || 0,
      image_url: data.thumbnail || '',
      categoria: data.ncm?.description || 'Outros',
      origem: '0',
      unidade: data.unit_type || 'UN',
      // Tax info from NCM
      ncm_full: data.ncm || null,
      brand: data.brand?.name || '',
      gpc: data.gpc?.description || '',
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('cosmos-lookup error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno ao consultar produto' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
