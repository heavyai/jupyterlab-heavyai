.DEFAULT_GOAL=build

include project.env
-include .env

pull:
	docker pull omnisci/core-os-cpu:${OMNISCI_VERSION}
	docker pull ${OMNISCI_IMAGE}

notebook:
	docker build \
		--build-arg DOCKER_NOTEBOOK_BASE=${DOCKER_NOTEBOOK_BASE} \
		-t ${DOCKER_NOTEBOOK_IMAGE} \
		${LABELS} \
		-f Dockerfile ..

notebook-jupyter:
	# See https://hub.docker.com/r/jupyter/scipy-notebook/tags for latest tags
	$(MAKE) notebook \
		DOCKER_NOTEBOOK_BASE=${JUPYTER_BASE_IMAGE} \
		DOCKER_NOTEBOOK_IMAGE=${USER}/omnisci-notebook:jupyter

# https://github.com/jupyter/docker-stacks
jupyter-stacks-cuda:
	# the jupyter/docker-stacks repo contains many features, so we want to reuse that
	# These are custom build of those stacks replacing the base image with nvidia/cuda
	$(MAKE) -C jupyter-docker-stacks build/base-notebook DARGS="--build-arg BASE_CONTAINER=${CUDA_IMAGE} -t ${USER}/base-notebook:${CUDA} ${LABELS}"
	$(MAKE) -C jupyter-docker-stacks build/minimal-notebook DARGS="--build-arg BASE_CONTAINER=${USER}/base-notebook:${CUDA} -t ${USER}/minimal-notebook:${CUDA} ${LABELS}"
	$(MAKE) -C jupyter-docker-stacks build/scipy-notebook DARGS="--build-arg BASE_CONTAINER=${USER}/minimal-notebook:${CUDA} -t ${USER}/scipy-notebook:${CUDA} ${LABELS}"

notebook-cuda: jupyter-stacks-cuda
	$(MAKE) notebook \
		DOCKER_NOTEBOOK_BASE=${USER}/scipy-notebook:${CUDA} \
		DOCKER_NOTEBOOK_IMAGE=${USER}/omnisci-jupyterlab:${CUDA}

notebook-cuda9:
	$(MAKE) notebook-cuda CUDA=cuda9 CUDA_IMAGE=${CUDA_9_IMAGE}

notebook-cuda10:
	$(MAKE) notebook-cuda CUDA=cuda10 CUDA_IMAGE=${CUDA_10_IMAGE}

# notebook-cuda-rapids: notebook-cuda
# 	docker build \
# 		--build-arg BASE_IMAGE=${DOCKER_REPO_USER}/omnisci-notebook:${CUDA} \
# 		-t ${DOCKER_REPO_USER}/omnisci-notebook:${CUDA}-rapidsai \
# 		${LABELS} \
# 		-f rapids/Dockerfile rapids

# notebook-cuda9-rapids:
# 	$(MAKE) notebook-cuda-rapids CUDA=cuda9 CUDA_IMAGE=${CUDA_9_IMAGE}

# notebook-cuda10-rapids:
# 	$(MAKE) notebook-cuda-rapids CUDA=cuda10 BASE_CONTAINER=${CUDA_10_IMAGE}

build: notebook-cuda9

tag:
	docker tag ${USER}/omnisci-jupyterlab:cuda9 ${DOCKER_REPO_USER}/omnisci-jupyterlab:cuda9
	docker tag ${USER}/omnisci-jupyterlab:cuda9 ${DOCKER_REPO_USER}/omnisci-jupyterlab:cuda9-$(shell date +'%Y%m%d')

push: tag
	# docker push ${DOCKER_REPO_USER}/omnisci-jupyterlab:jupyter

	docker push ${DOCKER_REPO_USER}/omnisci-jupyterlab:cuda9
	docker push ${DOCKER_REPO_USER}/omnisci-jupyterlab:cuda9-$(shell date +'%Y%m%d')
	
	# docker push ${DOCKER_REPO_USER}/omnisci-jupyterlab:cuda10

.PHONY: pull notebook notebook-jupyter notebook-cuda jupyter-stacks-cuda notebook-cuda-rapids notebook-cuda9-rapids notebook-cuda10-rapids build push
