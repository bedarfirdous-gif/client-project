#!/bin/bash

echo "Pulling latest code..."
git pull origin master

echo "Restarting backend service..."
sudo systemctl restart bijnisbooks

echo "Deployment completed."
