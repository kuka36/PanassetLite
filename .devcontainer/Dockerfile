FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# 换阿里云源加速 apt（国内网络优化）。
# 注意 arm64(Apple Silicon) 用的是 ports.ubuntu.com/ubuntu-ports，需单独替换，
# 否则 arm64 上 apt 仍走境外源、被迫依赖代理。
#RUN sed -i \
#    -e 's|archive\.ubuntu\.com|mirrors.aliyun.com|g' \
#    -e 's|security\.ubuntu\.com|mirrors.aliyun.com|g' \
#    -e 's|ports\.ubuntu\.com/ubuntu-ports|mirrors.aliyun.com/ubuntu-ports|g' \
#    /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true

# 先安装基础依赖与 keyring 相关工具
# 合并 apt-get，减少 layer 数量
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    sudo \
    wget \
    vim \
    unzip \
    openssh-client \
    software-properties-common \
    bubblewrap \
    && rm -rf /var/lib/apt/lists/*

# 配置 GitHub CLI 源
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list

# 配置 NodeSource 源
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# 安装主要开发工具
# 使用 cache mount 提升 apt 缓存复用效率（BuildKit）
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    jq \
    gh \
    nodejs \
    && rm -rf /var/lib/apt/lists/*


# 应用层 / 易变开发工具，集中在脚本里维护（增删工具只改这个脚本，不动上面的系统层逻辑）
COPY .agent/harness/install-tools.sh /tmp/install-tools.sh
RUN chmod +x /tmp/install-tools.sh && /tmp/install-tools.sh && rm /tmp/install-tools.sh

# sudo 配置
RUN usermod -aG sudo ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/ubuntu \
    && chmod 0440 /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /home/ubuntu

# 用户目录初始化
RUN mkdir -p /home/ubuntu/.ssh \
    && ssh-keyscan github.com >> /home/ubuntu/.ssh/known_hosts
