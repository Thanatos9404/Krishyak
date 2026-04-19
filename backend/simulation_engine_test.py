import sys
import os

# Append the backend directory to sys.path
sys.path.append(r'c:\Desktop\COLLEGE\Coding\Hackathon\Krishyak\backend')

from simulation_engine import SimulationEngine

engine = SimulationEngine()

base_params = {
    "crop": "Rice",
    "soil_type": "Clay",
    "area_hectares": 2.0,
    "seed_quality": 0.8,
    "expected_rainfall": 800,
    "rainfall_delay": 5,
    "irrigation_frequency": 3,
    "fertilizer_mix": {"Urea": 100, "DAP": 50, "MOP": 30},
    "pest_probability": 0.2,
    "pest_control_intensity": 0.5,
    "sale_month": 3,
    "current_market_price": 2000
}

print("Running Positive-to-Better-Positive Scenario...")
res1 = engine.run_whatif_simulation(base_params, 10)
print(res1['recommendation'])
print("-" * 50)

print("Running Negative-to-Positive Turnaround Scenario...")
bad_params = base_params.copy()
# High cost, bad sale month, low base stringency, expecting optimal to save it
bad_params['seed_quality'] = 0.5
bad_params['expected_rainfall'] = 400
bad_params['current_market_price'] = 1000
bad_params['labour_days'] = 60
res2 = engine.run_whatif_simulation(bad_params, 10)
print(f"Current Profit: {res2['current_plan']['profit']}, Optimal Profit: {res2['ai_optimal_plan']['profit']}")
print(res2['recommendation'])
print("-" * 50)

print("Running Both-Negative Scenario...")
doomed_params = bad_params.copy()
# Utterly doomed
doomed_params['expected_rainfall'] = 100
doomed_params['irrigation_frequency'] = 0
doomed_params['current_market_price'] = 500
res3 = engine.run_whatif_simulation(doomed_params, 10)
print(f"Current Profit: {res3['current_plan']['profit']}, Optimal Profit: {res3['ai_optimal_plan']['profit']}")
print(res3['recommendation'])
print("-" * 50)
