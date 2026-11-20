# Datasets Directory

This folder contains agricultural datasets required for KrishiSaarthi.

## Required Files

The following datasets should be placed in this directory:

1. **All-India_-Crop-wise-Area,-Production-&-Yield.csv**
   - Crop yield data by season and year
   
2. **9ef84268-d588-465a-a308-a864a43d0070.csv**
   - Market price data from Indian mandis

## How to Download Datasets

### Using Kaggle API (Recommended)

```python
import kagglehub

# Crop yield dataset
path1 = kagglehub.dataset_download("akshatgupta7/crop-yield-in-indian-states-dataset")

# Commodity prices dataset
path2 = kagglehub.dataset_download("ishankat/daily-wholesale-commodity-prices-india-mandis")

# Mandi prices
path3 = kagglehub.dataset_download("arjunyadav99/indian-agricultural-mandi-prices-20232025")

print("Path to dataset files:", path1, path2, path3)
```

### Manual Download

1. Visit: http://data.icrisat.org/dld/
2. Download crop yield and market price datasets
3. Place CSV files in this directory

## API key

Set `DATA_GOV_IN_API_KEY` in the ignored `backend/.env` (get a free key at https://data.gov.in). Never commit a key.

## Note

Dataset files are excluded from Git repository due to size. After cloning, download datasets using the methods above.
