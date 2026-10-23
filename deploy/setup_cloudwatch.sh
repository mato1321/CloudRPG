#!/bin/bash
# 在 EC2 上安裝 CloudWatch Agent，上傳記憶體 / swap / 磁碟使用率（CPU 是 EC2 內建指標，不需要 agent）
# 前提：EC2 已掛上 LabInstanceProfile（Learner Lab 的 LabRole，有 cloudwatch:PutMetricData 權限）
# 用法：bash ~/CloudRPG/deploy/setup_cloudwatch.sh
set -euo pipefail

if ! command -v /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl >/dev/null; then
  arch=$(dpkg --print-architecture)   # amd64（t3）或 arm64（t4g）
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/cwagent.deb" "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/$arch/latest/amazon-cloudwatch-agent.deb"
  sudo dpkg -i "$tmp/cwagent.deb"
  rm -rf "$tmp"
fi

sudo cp ~/CloudRPG/deploy/cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/cloudrpg.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudrpg.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
