import { DEFAULT_THRESHOLDS } from './core/stats'

export interface GlossaryEntry {
  label: string
  text: string
}

function gymTiers(): string {
  const { poiCounts, gymCounts } = DEFAULT_THRESHOLDS
  return poiCounts
    .map((n, i) => {
      const gyms = gymCounts[i] ?? 0
      return `${n} POIs → ${gyms} ${gyms === 1 ? 'gym' : 'gyms'}`
    })
    .join(', ')
}

const tiers = gymTiers()

export const GYM_TIERS_TEXT = tiers

export const TERMS = {
  s2: {
    label: 'S2 cells',
    text: 'S2 cuts the map into a grid of cells at different sizes. This app draws two sizes: S14 (large) and S17 (small).'
  },
  s14: {
    label: 'S14 cell (~0.6 km)',
    text: `A large cell that contains exactly 64 S17 cells. How many gyms it gets depends on how many POIs it holds (${tiers}). That is the community rule, not a guarantee.`
  },
  s17: {
    label: 'S17 cell (~70 m)',
    text: 'A small cell. An active stop or gym occupies it. A cell without one is free, which is where a new stop could go.'
  },
  poi: {
    label: 'POI (point of interest)',
    text: "Any place in your imported Wayfarer data: a Pokéstop, a gym, a Power Spot, or a place that isn't in the game."
  },
  nonGamePoi: {
    label: 'Non-game POI',
    text: "A place in your Wayfarer data that is not an active stop, gym or Power Spot (no game object, inactive, or another game brand). It does not occupy a cell. Called 'other' in some places."
  },
  powerSpot: {
    label: 'Power Spot',
    text: 'A place with an active Power Spot game object. It does not occupy an S17 cell.'
  },
  wayfarer: {
    label: 'Wayfarer',
    text: 'The tool used to nominate new Pokéstops. This app reads a JSON export of Wayfarer search results that you import yourself.'
  },
  statsMode: {
    label: 'Color S14 cells by stats',
    text: 'Colors each S14 cell on the map by how close it is to the next gym tier: green = top tier reached, amber = 1 POI short, red = 2 or more POIs short.'
  },
  totalPoi: {
    label: 'POIs',
    text: 'Every POI in the S14 cell: stops, gyms and all other places. This total is what the gym estimate uses.'
  },
  gymsExpected: {
    label: 'Gyms expected',
    text: `The gym count this S14 cell should have, from its POI total (${tiers}). An estimate, not a guarantee.`
  },
  toNextGym: {
    label: 'To next gym',
    text: 'How many more POIs this S14 cell needs to reach the next gym tier. 0 means it is already at the top tier.'
  },
  freeCells: {
    label: 'Free S17 cells',
    text: 'S17 cells in this S14 cell with no active stop or gym. Cells you marked Proposed or In review are not counted. Cells with incomplete data show 0, because the real number is unknown.'
  },
  incompleteData: {
    label: 'Incomplete data',
    text: "Wayfarer limits how many POIs it returns per S14 cell. When a cell reaches 50 or more, some POIs may be missing, so its free cells can't be trusted."
  },
  marks: {
    label: 'Mark status',
    text: 'Planned: you intend to nominate here. Proposed: you submitted a nomination. In review: Wayfarer is reviewing it. Rejected and Approved are the outcomes. Proposed and In review cells are not counted as free in the S14 table.'
  },
  rangeTool: {
    label: 'Range tool',
    text: 'Draws a circle on the map (20–500 m). Click the map to place its center. It lists the stops and gyms inside the circle and counts the S17 and S14 cells it touches.'
  },
  rangeRings: {
    label: '80 m rings',
    text: 'Draws an 80 m circle around every stop and gym.'
  },
  location: {
    label: 'Show my location',
    text: 'Follows your GPS position on the map. Your browser asks for permission first.'
  },
  importMerge: {
    label: 'How imports merge',
    text: 'Imports are merged into your existing data, not replaced. A cell you re-import is updated from the new data and all other cells stay. Importing the same file twice changes nothing.'
  },
  removed: {
    label: 'Removed POIs',
    text: 'POIs that were in a cell you re-imported but are missing from the new data, because they disappeared in Wayfarer. Cells with incomplete data never remove POIs.'
  }
} satisfies Record<string, GlossaryEntry>

export type TermId = keyof typeof TERMS

export const GLOSSARY: { id: TermId; label: string; text: string }[] = (
  Object.keys(TERMS) as TermId[]
).map((id) => ({ id, ...TERMS[id] }))
