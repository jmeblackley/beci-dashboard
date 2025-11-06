// Do NOT commit this file. .gitignore should list "config.local.js".
window.BECI_CONFIG = {
  apiKey: "AAPTxy8BH1VEsoebNVZXo8HurKC8LWXmfGB2HYfFZFZ5-zmTluOSVcZdMvfJTHTKmm-v147XzhBV9caO-JxkYVKbhf2MhdLnGwGcGWuVDLnABZJOZZzTHWwwORX2hf4AqU_TZJKpurRbJ84sJ9iox_2TiUHvvx6lzim0dC8RIt_eL-nVO3ZHs7eN5fjLtkP_kaIrx7CFhqcYnu54JOPXpPgIVGSWzRvc148PZkYESenAz7g.AT1_edvS32F3",

  spatialReference: { wkid: 3832 },

  items: {
    sstMonthlyId: "8c551d176e0e48ddaec623545f4899f2",
    sstAnnualId:  "91743c7b6f354494acc8c822e2a40df6",
    chlMonthlyId: "908f4c3f5dd24035b72ef6b0a3551855",
    mhwMonthlyId: "3eb9dc4649204d0498760ead24c58afc",

    speciesCollectionId: "f97d35b2f30c4c1fb29df6c7df9030d5",
    // + add under window.BECI_CONFIG.items
    eezId:  "b8b8751d007d4425bc80368505a74f06",   // Exclusive Economic Zones
    rfmoId: "b7a44afd535344368d66f884bc06ecec",    // RFMOs (your new hosted layer)

    impactMapId:   "5a820135359e42ac9fe107e3043e5a33",
    stockStatusId: "7ac11d00696c4760bd80666254ca2c6f",
    // ID for the LME health polygons (joined with status attributes)
    lmeHealthId: "3ca4c0dfea2c4212b15c4dba53eb4189",
    // ID for the LME boundary shell layer (names only)
    lmeId: "21a5a136aa154717a4f77b819dff91c7"
  }
};
