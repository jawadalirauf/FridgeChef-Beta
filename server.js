// const express = require('express');
// const axios = require('axios');
// const path = require('path');
// const app = express();
// const PORT = 3000;

// // API CONFIGURATION
// const SPOON_KEY = 'c8c1ffb28fbb4c67ad87a1718be596ff'; 

// app.use(express.static(path.join(__dirname, 'public')));

// // --- 1. SEARCH ROUTE (Combines Both APIs) ---
// app.get('/api/search', async (req, res) => {
//     const query = req.query.ingredients; // User types: "chicken, tomato"
//     const mainIngredient = query.split(',')[0].trim(); // Extract "chicken" for MealDB

//     try {
//         // Run both requests at the same time using Promise.all
//         const [spoonResponse, mealDbResponse] = await Promise.allSettled([
//             // Request 1: Spoonacular
//             axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
//                 params: {
//                     apiKey: SPOON_KEY,
//                     ingredients: query,
//                     number: 6, // Fetch 6 from Spoonacular
//                     ranking: 1,
//                     ignorePantry: true
//                 }
//             }),
//             // Request 2: TheMealDB (Search by main ingredient)
//             axios.get(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${mainIngredient}`)
//         ]);

//         let combinedResults = [];

//         // Process Spoonacular Results
//         if (spoonResponse.status === 'fulfilled' && spoonResponse.value.data) {
//             const spoonRecipes = spoonResponse.value.data.map(item => ({
//                 id: `S_${item.id}`, // Add 'S_' prefix
//                 title: item.title,
//                 image: item.image,
//                 missingCount: item.missedIngredientCount,
//                 source: 'Spoonacular'
//             }));
//             combinedResults = [...combinedResults, ...spoonRecipes];
//         }

//         // Process TheMealDB Results
//         if (mealDbResponse.status === 'fulfilled' && mealDbResponse.value.data.meals) {
//             const mealDbRecipes = mealDbResponse.value.data.meals.slice(0, 6).map(item => ({
//                 id: `M_${item.idMeal}`, // Add 'M_' prefix
//                 title: item.strMeal,
//                 image: item.strMealThumb,
//                 missingCount: null, // MealDB doesn't tell us this
//                 source: 'TheMealDB'
//             }));
//             combinedResults = [...combinedResults, ...mealDbRecipes];
//         }

//         // --- DEDUPLICATION LOGIC ---
//         // Remove duplicates based on Title (ignoring case)
//         const uniqueRecipes = [];
//         const seenTitles = new Set();

//         combinedResults.forEach(recipe => {
//             const normalizedTitle = recipe.title.toLowerCase().trim();
//             if (!seenTitles.has(normalizedTitle)) {
//                 seenTitles.add(normalizedTitle);
//                 uniqueRecipes.push(recipe);
//             }
//         });

//         // Optional: Shuffle results so they are mixed together
//         const shuffled = uniqueRecipes.sort(() => Math.random() - 0.5);

//         res.json(shuffled);

//     } catch (error) {
//         console.error("Search Error:", error);
//         res.status(500).json({ error: 'Failed to fetch recipes' });
//     }
// });

// // --- 2. DETAILS ROUTE (Handles S_ and M_ prefixes) ---
// app.get('/api/recipe/:id', async (req, res) => {
//     const fullId = req.params.id; // e.g., "S_12345" or "M_52772"
    
//     // Extract Prefix and Real ID
//     const prefix = fullId.split('_')[0]; // "S" or "M"
//     const realId = fullId.split('_')[1]; // "12345"

//     try {
//         let recipeData = {};

//         if (prefix === 'S') {
//             // --- FETCH FROM SPOONACULAR ---
//             const response = await axios.get(`https://api.spoonacular.com/recipes/${realId}/information`, {
//                 params: { apiKey: SPOON_KEY }
//             });
//             const data = response.data;
            
//             recipeData = {
//                 title: data.title,
//                 image: data.image,
//                 time: data.readyInMinutes,
//                 servings: data.servings,
//                 ingredients: data.extendedIngredients.map(i => i.original),
//                 // Handle different instruction formats
//                 instructions: data.analyzedInstructions?.[0]?.steps?.map(s => s.step) || 
//                               (data.instructions ? [data.instructions] : ["No instructions provided."])
//             };

//         } else if (prefix === 'M') {
//             // --- FETCH FROM THEMEALDB ---
//             const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${realId}`);
//             const meal = response.data.meals[0];

//             // Helper to collect ingredients from MealDB's weird format
//             let ingredients = [];
//             for (let i = 1; i <= 20; i++) {
//                 if (meal[`strIngredient${i}`] && meal[`strIngredient${i}`].trim() !== "") {
//                     const measure = meal[`strMeasure${i}`] || "";
//                     ingredients.push(`${measure} ${meal[`strIngredient${i}`]}`);
//                 }
//             }

//             recipeData = {
//                 title: meal.strMeal,
//                 image: meal.strMealThumb,
//                 time: "30", // Default (MealDB doesn't have time)
//                 servings: "2", // Default
//                 ingredients: ingredients,
//                 instructions: meal.strInstructions.split(/\r\n|\n|\./).filter(s => s.trim().length > 5)
//             };
//         }

//         res.json(recipeData);

//     } catch (error) {
//         console.error("Detail Error:", error.message);
//         res.status(500).json({ error: 'Failed to fetch recipe details' });
//     }
// });

// app.listen(PORT, () => {
//     console.log(`Server running at http://localhost:${PORT}`);
// });

const express = require('express');
const axios = require('axios');
const path = require('path');
const sql = require('mssql/msnodesqlv8'); // Required for Windows Auth
const app = express();
const PORT = 3000;

// Middleware for parsing JSON and serving static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API CONFIGURATION
const SPOON_KEY = 'c8c1ffb28fbb4c67ad87a1718be596ff'; 

// --- SQL SERVER CONFIGURATION (Windows Authentication) ---
const sqlConfig = {
    connectionString: 'Driver={SQL Server};Server=localhost;Database=FridgeChefDB;Trusted_Connection=yes;',
};

// --- INITIAL CONNECTION TEST ---
sql.connect(sqlConfig).then(pool => {
    if (pool.connected) {
        console.log("✅ FridgeChef Database Connected Successfully via Windows Auth!");
    }
}).catch(err => {
    console.error("❌ SQL Connection Error: ", err.message);
});

// --- 1. AUTHENTICATION ROUTES ---

// Signup: Adds user to SSMS 'Users' table
app.post('/api/signup', async (req, res) => {
    const { fullName, email, password } = req.body;
    try {
        let pool = await sql.connect(sqlConfig);
        await pool.request()
            .input('name', sql.NVarChar, fullName)
            .input('email', sql.NVarChar, email)
            .input('pass', sql.NVarChar, password)
            .query('INSERT INTO Users (FullName, Email, Password) VALUES (@name, @email, @pass)');
        res.json({ success: true });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Signup failed." });
    }
});

// Login: Verifies credentials and returns FullName to personalize profile
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let pool = await sql.connect(sqlConfig);
        let result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('pass', sql.NVarChar, password)
            .query('SELECT FullName FROM Users WHERE Email = @email AND Password = @pass');

        if (result.recordset.length > 0) {
            res.json({ success: true, fullName: result.recordset[0].FullName });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password." });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Database error." });
    }
});

// --- 2. SEARCH ROUTE (Dual API + Deduplication + Shuffling) ---
app.get('/api/search', async (req, res) => {
    const query = req.query.ingredients; 
    const mainIngredient = query.split(',')[0].trim(); 

    try {
        const [spoonResponse, mealDbResponse] = await Promise.allSettled([
            axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
                params: {
                    apiKey: SPOON_KEY,
                    ingredients: query,
                    number: 6,
                    ranking: 1,
                    ignorePantry: true
                }
            }),
            axios.get(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${mainIngredient}`)
        ]);

        let combinedResults = [];

        if (spoonResponse.status === 'fulfilled' && spoonResponse.value.data) {
            const spoonRecipes = spoonResponse.value.data.map(item => ({
                id: `S_${item.id}`,
                title: item.title,
                image: item.image,
                missingCount: item.missedIngredientCount,
                source: 'Spoonacular'
            }));
            combinedResults = [...combinedResults, ...spoonRecipes];
        }

        if (mealDbResponse.status === 'fulfilled' && mealDbResponse.value.data.meals) {
            const mealDbRecipes = mealDbResponse.value.data.meals.slice(0, 6).map(item => ({
                id: `M_${item.idMeal}`,
                title: item.strMeal,
                image: item.strMealThumb,
                missingCount: null,
                source: 'TheMealDB'
            }));
            combinedResults = [...combinedResults, ...mealDbRecipes];
        }

        const uniqueRecipes = [];
        const seenTitles = new Set();

        combinedResults.forEach(recipe => {
            const normalizedTitle = recipe.title.toLowerCase().trim();
            if (!seenTitles.has(normalizedTitle)) {
                seenTitles.add(normalizedTitle);
                uniqueRecipes.push(recipe);
            }
        });

        const shuffled = uniqueRecipes.sort(() => Math.random() - 0.5);
        res.json(shuffled);

    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ error: 'Failed to fetch recipes.' });
    }
});

// --- 3. DETAILS ROUTE (Original Prefix Logic) ---
app.get('/api/recipe/:id', async (req, res) => {
    const fullId = req.params.id;
    const prefix = fullId.split('_')[0];
    const realId = fullId.split('_')[1];

    try {
        let recipeData = {};

        if (prefix === 'S') {
            const response = await axios.get(`https://api.spoonacular.com/recipes/${realId}/information`, {
                params: { apiKey: SPOON_KEY }
            });
            const data = response.data;
            recipeData = {
                title: data.title,
                image: data.image,
                time: data.readyInMinutes,
                servings: data.servings,
                ingredients: data.extendedIngredients.map(i => i.original),
                instructions: data.analyzedInstructions?.[0]?.steps?.map(s => s.step) || 
                             (data.instructions ? [data.instructions] : ["No instructions provided."])
            };
        } else if (prefix === 'M') {
            const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${realId}`);
            const meal = response.data.meals[0];
            let ingredients = [];
            for (let i = 1; i <= 20; i++) {
                if (meal[`strIngredient${i}`] && meal[`strIngredient${i}`].trim() !== "") {
                    const measure = meal[`strMeasure${i}`] || "";
                    ingredients.push(`${measure} ${meal[`strIngredient${i}`]}`);
                }
            }
            recipeData = {
                title: meal.strMeal,
                image: meal.strMealThumb,
                time: "30",
                servings: "2",
                ingredients: ingredients,
                instructions: meal.strInstructions.split(/\r\n|\n|\./).filter(s => s.trim().length > 5)
            };
        }
        res.json(recipeData);
    } catch (error) {
        console.error("Detail Error:", error.message);
        res.status(500).json({ error: 'Failed to fetch recipe details.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});