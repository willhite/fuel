import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
}

async function request(method, path, body = null) {
  const headers = await getHeaders()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getDay: (date) => request('GET', `/meals/day/${date}`),
  addMeal: (meal) => request('POST', '/meals/', meal),
  deleteMeal: (id) => request('DELETE', `/meals/${id}`),
  getHistory: (limit = 14) => request('GET', `/meals/history?limit=${limit}`),
  getProfile: () => request('GET', '/profile/'),
  updateProfile: (data) => request('PATCH', '/profile/', data),
  searchFoods: (query) => request('GET', `/usda/search?query=${encodeURIComponent(query)}`),
  getRecipes: () => request('GET', '/recipes/'),
  createRecipe: (data) => request('POST', '/recipes/', data),
  deleteRecipe: (id) => request('DELETE', `/recipes/${id}`),
  addIngredient: (recipeId, data) => request('POST', `/recipes/${recipeId}/ingredients`, data),
  removeIngredient: (recipeId, ingredientId) => request('DELETE', `/recipes/${recipeId}/ingredients/${ingredientId}`),
  updateRecipe: (id, data) => request('PATCH', `/recipes/${id}`, data),
  updateIngredient: (recipeId, ingredientId, data) => request('PATCH', `/recipes/${recipeId}/ingredients/${ingredientId}`, data),
  logRecipe: (recipeId, data) => request('POST', `/recipes/${recipeId}/log`, data),
  patchMealPortion: (mealId, portionWeight) => request('PATCH', `/meals/${mealId}/portion`, { portion_weight: portionWeight }),
  restoreTemplate: (recipeId, mealId) => request('POST', `/recipes/${recipeId}/restore-from-meal/${mealId}`),
}
