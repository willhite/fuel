import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const MACRO_FIELDS = [
  { key: 'calories_per_100g', label: 'kcal' },
  { key: 'protein_per_100g', label: 'P' },
  { key: 'carbs_per_100g', label: 'C' },
  { key: 'fat_per_100g', label: 'F' },
  { key: 'fiber_per_100g', label: 'Fb' },
]

const EMPTY_FORM = {
  name: '',
  calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '', fiber_per_100g: '',
  upc: '', source: 'manual', source_name: '',
}

const SOURCE_LABEL = { usda: 'USDA', open_food_facts: 'Open Food Facts', manual: 'manual' }

export default function AdminPage() {
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [upcQuery, setUpcQuery] = useState('')
  const [upcLooking, setUpcLooking] = useState(false)
  const [upcStatus, setUpcStatus] = useState('') // '' | 'found' | 'not_found'
  const [nameQuery, setNameQuery] = useState('')
  const [nameSearching, setNameSearching] = useState(false)
  const [nameResults, setNameResults] = useState([])

  const load = useCallback(async () => {
    try {
      const data = await api.getIngredients()
      setIngredients(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleUpcLookup() {
    if (!upcQuery.trim()) return
    setUpcLooking(true)
    setUpcStatus('')
    try {
      const result = await api.lookupUpc(upcQuery.trim())
      setForm({
        name: result.source_name,
        upc: result.upc,
        source: result.source,
        source_name: result.source_name,
        calories_per_100g: String(result.calories_per_100g),
        protein_per_100g: String(result.protein_per_100g),
        carbs_per_100g: String(result.carbs_per_100g),
        fat_per_100g: String(result.fat_per_100g),
        fiber_per_100g: String(result.fiber_per_100g),
      })
      setUpcQuery('')
      setUpcStatus('found')
    } catch {
      setUpcStatus('not_found')
    } finally {
      setUpcLooking(false)
    }
  }

  async function handleNameSearch() {
    if (!nameQuery.trim()) return
    setNameSearching(true)
    setNameResults([])
    try {
      const results = await api.searchFoods(nameQuery.trim())
      setNameResults(results.slice(0, 8))
    } catch (err) {
      setError(err.message)
    } finally {
      setNameSearching(false)
    }
  }

  function handleSelectSearchResult(food) {
    setForm({
      name: food.name,
      upc: '',
      source: 'usda',
      source_name: food.name,
      calories_per_100g: String(food.calories_per_100g),
      protein_per_100g: String(food.protein_per_100g),
      carbs_per_100g: String(food.carbs_per_100g),
      fat_per_100g: String(food.fat_per_100g),
      fiber_per_100g: String(food.fiber_per_100g),
    })
    setNameResults([])
    setNameQuery('')
    setUpcStatus('found')
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        calories_per_100g: parseFloat(form.calories_per_100g) || 0,
        protein_per_100g: parseFloat(form.protein_per_100g) || 0,
        carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
        fat_per_100g: parseFloat(form.fat_per_100g) || 0,
        fiber_per_100g: parseFloat(form.fiber_per_100g) || 0,
        upc: form.upc || null,
        source: form.source || null,
        source_name: form.source_name || null,
      }
      const created = await api.createIngredient(payload)
      setIngredients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(EMPTY_FORM)
      setUpcStatus('')
      setNameResults([])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFieldBlur(id, field, value) {
    const isString = field === 'name' || field === 'upc'
    const parsed = isString ? (value === null ? null : String(value).trim() || null) : parseFloat(value)
    if (!isString && isNaN(parsed)) return
    if (field === 'name' && !parsed) return
    try {
      const updated = await api.updateIngredientLib(id, { [field]: parsed })
      setIngredients(prev =>
        [...prev.map(i => i.id === id ? updated : i)].sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteIngredient(id)
      setIngredients(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-mono">
      <header className="max-w-3xl mx-auto px-5 pt-10 pb-0 flex justify-between items-end">
        <div className="flex items-baseline gap-3">
          <button onClick={() => navigate('/')} className="text-5xl font-black tracking-tight hover:opacity-80 transition-opacity">
            fu<span className="text-blue-600">el</span>
          </button>
          <span className="text-slate-400 text-sm">/ ingredients</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Add form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Add Ingredient (per 100g)</p>

          {/* UPC lookup */}
          <div className="flex gap-2 items-center mb-4">
            <input
              type="text"
              placeholder="UPC barcode"
              value={upcQuery}
              onChange={e => { setUpcQuery(e.target.value); setUpcStatus('') }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleUpcLookup())}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={handleUpcLookup}
              disabled={upcLooking || !upcQuery.trim()}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-600 hover:border-blue-600 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {upcLooking ? '...' : 'lookup'}
            </button>
            {upcStatus === 'found' && (
              <span className="text-xs text-emerald-600 whitespace-nowrap">
                found via {SOURCE_LABEL[form.source] || form.source}
              </span>
            )}
            {upcStatus === 'not_found' && (
              <span className="text-xs text-red-500 whitespace-nowrap">not found</span>
            )}
          </div>

          {/* Name search */}
          <div className="flex gap-2 items-center mb-4">
            <input
              type="text"
              placeholder="Search by name (USDA)"
              value={nameQuery}
              onChange={e => { setNameQuery(e.target.value); if (!e.target.value.trim()) setNameResults([]) }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleNameSearch())}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={handleNameSearch}
              disabled={nameSearching || !nameQuery.trim()}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-600 hover:border-blue-600 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {nameSearching ? '...' : 'search'}
            </button>
          </div>
          {nameResults.length > 0 && (
            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden mb-4">
              {nameResults.map(food => (
                <button
                  key={food.fdc_id}
                  type="button"
                  onClick={() => handleSelectSearchResult(food)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0 transition-colors"
                >
                  <span className="text-slate-900">{food.name}</span>
                  <span className="text-slate-400 text-xs ml-2">{food.calories_per_100g} kcal · P {food.protein_per_100g}g · C {food.carbs_per_100g}g · F {food.fat_per_100g}g</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Display name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            <div className="flex gap-2 flex-wrap">
              {MACRO_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex-1 min-w-16">
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="0"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-between">
              <input
                type="text"
                placeholder="UPC (optional)"
                value={form.upc}
                onChange={e => setForm(f => ({ ...f, upc: e.target.value }))}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>

        {/* Ingredient list */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 uppercase tracking-widest">Library</p>
            <p className="text-xs text-slate-400">{ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}</p>
          </div>
          {loading ? (
            <p className="text-xs text-slate-400 px-5 py-4">Loading...</p>
          ) : ingredients.length === 0 ? (
            <p className="text-xs text-slate-400 px-5 py-4">No ingredients yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {ingredients.map(ing => (
                <div key={ing.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      defaultValue={ing.name}
                      onBlur={e => { if (e.target.value !== ing.name) handleFieldBlur(ing.id, 'name', e.target.value) }}
                      className="flex-1 min-w-0 text-sm text-slate-900 bg-transparent border-b border-transparent focus:border-blue-600 focus:outline-none transition-colors"
                    />
                    <div className="flex gap-2 flex-shrink-0">
                      {MACRO_FIELDS.map(({ key, label }) => (
                        <div key={key} className="flex flex-col items-center">
                          <span className="text-xs text-slate-400 leading-none mb-0.5">{label}</span>
                          <input
                            type="number" min="0" step="0.01"
                            defaultValue={ing[key]}
                            onBlur={e => { if (parseFloat(e.target.value) !== ing[key]) handleFieldBlur(ing.id, key, e.target.value) }}
                            className="w-14 text-xs text-center bg-slate-50 border border-slate-200 rounded-lg px-1 py-1 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors text-xs flex-shrink-0"
                    >✕</button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="UPC"
                      defaultValue={ing.upc || ''}
                      onBlur={e => { if ((e.target.value.trim() || null) !== (ing.upc || null)) handleFieldBlur(ing.id, 'upc', e.target.value) }}
                      className="w-36 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 placeholder-slate-300"
                    />
                    {ing.source && (
                      <span className="text-xs text-slate-300">
                        {SOURCE_LABEL[ing.source] || ing.source}
                        {ing.source_name && ing.source_name !== ing.name && ` · "${ing.source_name}"`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
