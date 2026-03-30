"""
Proxy views for Google Places API. Keeps API key on server for security.
"""
import json
from urllib.parse import urlencode
from urllib.request import urlopen, Request

from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.views.decorators.http import require_GET


def _fetch_json(url: str) -> dict:
    """Fetch URL and return JSON."""
    req = Request(url, headers={'User-Agent': 'DeepClean/1.0'})
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


@require_GET
def place_autocomplete(request):
    """
    GET /api/places/autocomplete/?input=xxx
    Proxies to Google Places Autocomplete API, restricted to France.
    """
    input_val = request.GET.get('input', '').strip()
    if len(input_val) < 2:
        return JsonResponse({'predictions': []})

    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', None)
    if not api_key:
        return JsonResponse({'error': 'Places API not configured'}, status=500)

    params = {
        'input': input_val,
        'types': 'address',
        'components': 'country:fr',
        'language': 'fr',
        'key': api_key,
    }
    session_token = request.GET.get('session_token')
    if session_token:
        params['sessiontoken'] = session_token

    url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?{urlencode(params)}"
    try:
        data = _fetch_json(url)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=502)

    if data.get('status') not in ('OK', 'ZERO_RESULTS'):
        return JsonResponse({'error': data.get('status', 'Unknown error')}, status=400)

    predictions = [
        {
            'place_id': p.get('place_id'),
            'description': p.get('description', ''),
            'structured_formatting': p.get('structured_formatting', {}),
        }
        for p in data.get('predictions', [])
    ]
    return JsonResponse({'predictions': predictions})


@require_GET
def place_details(request):
    """
    GET /api/places/details/?place_id=xxx
    Proxies to Google Place Details API.
    Returns formatted_address, ville (locality), code_postal (postal_code).
    """
    place_id = request.GET.get('place_id', '').strip()
    if not place_id:
        return JsonResponse({'error': 'place_id is required'}, status=400)

    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', None)
    if not api_key:
        return JsonResponse({'error': 'Places API not configured'}, status=500)

    params = {
        'place_id': place_id,
        'fields': 'formatted_address,address_components',
        'language': 'fr',
        'key': api_key,
    }
    session_token = request.GET.get('session_token')
    if session_token:
        params['sessiontoken'] = session_token

    url = f"https://maps.googleapis.com/maps/api/place/details/json?{urlencode(params)}"
    try:
        data = _fetch_json(url)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=502)

    if data.get('status') != 'OK':
        return JsonResponse({'error': data.get('status', 'Unknown error')}, status=400)

    result = data.get('result', {})
    formatted_address = result.get('formatted_address', '')
    ville = ''
    code_postal = ''

    for comp in result.get('address_components', []):
        types = comp.get('types', [])
        if 'postal_code' in types:
            code_postal = comp.get('long_name', '')
        if 'locality' in types:
            ville = comp.get('long_name', '')
        elif 'administrative_area_level_2' in types and not ville:
            ville = comp.get('long_name', '')

    return JsonResponse({
        'formatted_address': formatted_address,
        'ville': ville,
        'code_postal': code_postal,
    })
